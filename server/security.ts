import type { Express, Request, Response, NextFunction } from "express";

/**
 * Rate limiting de autenticação.
 *
 * Cuidados que motivaram esta implementação:
 *
 * 1. `req.ip` só é confiável se `trust proxy` estiver configurado de acordo com a
 *    infraestrutura real. Com `trust proxy` ligado e a aplicação exposta direto,
 *    qualquer um troca o `X-Forwarded-For` a cada requisição e zera o contador.
 *    Por isso o `trust proxy` agora vem de env (ver `configureTrustProxy`) e o
 *    padrão é NÃO confiar.
 * 2. Limitar só por IP não protege conta específica quando o atacante tem vários
 *    IPs. Contamos também por usuário-alvo.
 * 3. O contador antigo subia em TODA requisição a /api/login, inclusive as bem
 *    sucedidas — um usuário legítimo se autobloqueava. Agora só falha conta.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * ATENÇÃO — limites por IP em uso compartilhado.
 *
 * Em evento presencial (feira, SEBRAE, treinamento) centenas de pessoas usam o
 * MESMO WiFi e chegam com o MESMO IP público. E atrás de proxy/CDN mal
 * configurado todo mundo aparece com o IP do proxy. Um teto baixo por IP
 * derruba o cadastro do evento inteiro depois das primeiras dezenas de pessoas.
 *
 * Por isso:
 * - o limite POR CONTA é a proteção real contra força bruta em um usuário
 *   específico e continua apertado;
 * - o limite POR IP existe só para conter automação grosseira e vem folgado,
 *   configurável por ambiente. `0` desliga.
 *
 * Para o dia do evento, ajuste no .env:
 *   LOGIN_MAX_PER_IP=0
 *   REGISTER_MAX_PER_IP=0
 */
function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// 0 = sem limite
const MAX_ATTEMPTS_PER_IP = envLimit("LOGIN_MAX_PER_IP", 300);
const MAX_ATTEMPTS_PER_ACCOUNT = envLimit("LOGIN_MAX_PER_ACCOUNT", 10);
const MAX_REGISTRATIONS_PER_IP = envLimit("REGISTER_MAX_PER_IP", 500);

type Bucket = { count: number; resetTime: number };

class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly windowMs: number) {}

  /** Quantas tentativas já foram contadas para esta chave na janela atual. */
  count(key: string, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetTime) return 0;
    return bucket.count;
  }

  /** Segundos restantes até a janela zerar. */
  retryAfter(key: string, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetTime) return 0;
    return Math.ceil((bucket.resetTime - now) / 1000);
  }

  increment(key: string, now: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetTime) {
      this.buckets.set(key, { count: 1, resetTime: now + this.windowMs });
      return;
    }
    bucket.count++;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  sweep(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetTime) this.buckets.delete(key);
    }
  }
}

const loginLimiter = new RateLimiter(WINDOW_MS);
const registerLimiter = new RateLimiter(WINDOW_MS);

/**
 * Rotas públicas (dashboard da empresa por token). Janela curta e teto alto:
 * a intenção é conter varredura automatizada, não atrapalhar quem atualiza a
 * página. Como não há autenticação, sem isso qualquer um mantém o endpoint
 * sob carga contínua.
 */
const PUBLIC_WINDOW_MS = 60 * 1000;
const publicLimiter = new RateLimiter(PUBLIC_WINDOW_MS);

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function attemptedAccount(req: Request): string | null {
  const body = req.body as { username?: unknown; email?: unknown } | undefined;
  const raw = body?.username ?? body?.email;
  return typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : null;
}

/**
 * `trust proxy` precisa refletir a infraestrutura real:
 * - atrás de 1 proxy (Vercel, nginx, Cloudflare): TRUST_PROXY=1
 * - atrás de N proxies encadeados: TRUST_PROXY=N
 * - exposto direto: deixe vazio/false (padrão)
 * Confiar sem proxy na frente torna `req.ip` controlado pelo cliente.
 */
export function configureTrustProxy(app: Express) {
  const raw = process.env.TRUST_PROXY;

  if (!raw || raw === "false" || raw === "0") {
    app.set("trust proxy", false);
    return;
  }

  const hops = Number(raw);
  app.set("trust proxy", Number.isFinite(hops) && hops > 0 ? hops : raw);
}

export function setupSecurity(app: Express) {
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    // X-XSS-Protection é obsoleto e pode introduzir problemas; navegadores
    // modernos ignoram. Mantido desligado explicitamente.
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    if (req.secure || req.get("X-Forwarded-Proto") === "https") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    next();
  });

  app.disable("x-powered-by");

  // --- Login: bloqueia se IP OU conta-alvo estourarem a janela ---
  app.use("/api/login", (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ipKey = `ip:${clientIp(req)}`;
    const account = attemptedAccount(req);
    const accountKey = account ? `user:${account}` : null;

    // limite 0 = desligado (ver comentário sobre IP compartilhado no topo)
    const overIp =
      MAX_ATTEMPTS_PER_IP > 0 &&
      loginLimiter.count(ipKey, now) >= MAX_ATTEMPTS_PER_IP;
    const overAccount =
      MAX_ATTEMPTS_PER_ACCOUNT > 0 &&
      accountKey !== null &&
      loginLimiter.count(accountKey, now) >= MAX_ATTEMPTS_PER_ACCOUNT;

    if (overIp || overAccount) {
      const seconds = Math.max(
        loginLimiter.retryAfter(ipKey, now),
        accountKey ? loginLimiter.retryAfter(accountKey, now) : 0,
      );
      const minutesLeft = Math.ceil(seconds / 60);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({
        error: `Muitas tentativas de login. Tente novamente em ${minutesLeft} minutos.`,
        minutesLeft,
      });
    }

    // Só conta o que falhou: login bem-sucedido não penaliza o usuário.
    res.on("finish", () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        loginLimiter.increment(ipKey, Date.now());
        if (accountKey) loginLimiter.increment(accountKey, Date.now());
      } else if (res.statusCode < 400) {
        loginLimiter.reset(ipKey);
        if (accountKey) loginLimiter.reset(accountKey);
      }
    });

    next();
  });

  // --- Registro: limite generoso, só para conter criação em massa de contas ---
  app.use("/api/register", (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ipKey = `ip:${clientIp(req)}`;

    if (
      MAX_REGISTRATIONS_PER_IP > 0 &&
      registerLimiter.count(ipKey, now) >= MAX_REGISTRATIONS_PER_IP
    ) {
      const seconds = registerLimiter.retryAfter(ipKey, now);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({
        error: "Muitas tentativas de cadastro. Tente novamente mais tarde.",
      });
    }

    res.on("finish", () => {
      if (res.statusCode < 500) registerLimiter.increment(ipKey, Date.now());
    });

    next();
  });

  // --- Rotas públicas: sem autenticação, precisam de teto próprio ---
  app.use("/api/public", (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ipKey = `ip:${clientIp(req)}`;
    const teto = envLimit("PUBLIC_MAX_PER_MINUTE", 60);

    if (teto > 0 && publicLimiter.count(ipKey, now) >= teto) {
      const seconds = publicLimiter.retryAfter(ipKey, now);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({ error: "Muitas requisições. Aguarde um instante." });
    }

    publicLimiter.increment(ipKey, now);
    next();
  });

  const sweeper = setInterval(() => {
    const now = Date.now();
    loginLimiter.sweep(now);
    registerLimiter.sweep(now);
    publicLimiter.sweep(now);
  }, 60 * 1000);
  // não segura o processo aberto no shutdown
  sweeper.unref?.();
}
