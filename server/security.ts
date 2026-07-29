import type { Express, Request, Response, NextFunction } from "express";
import { registrar, zerar, limparVencidos } from "./rateLimitStore";

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
 * 4. Os contadores viviam num Map em memória: com mais de uma instância cada
 *    uma tinha o próprio limite (N instâncias = N vezes mais tentativas) e um
 *    restart zerava até os bloqueios ativos. Agora ficam no Postgres —
 *    ver server/rateLimitStore.ts.
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

/**
 * Rotas públicas (dashboard da empresa por token). Janela curta e teto alto:
 * a intenção é conter varredura automatizada, não atrapalhar quem atualiza a
 * página. Como não há autenticação, sem isso qualquer um mantém o endpoint
 * sob carga contínua.
 */
const PUBLIC_WINDOW_MS = 60 * 1000;

/** Segundos que faltam para a janela virar, para o cabeçalho Retry-After. */
function segundosRestantes(expiraEm: Date): number {
  return Math.max(1, Math.ceil((expiraEm.getTime() - Date.now()) / 1000));
}

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
  app.use("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    const ipKey = `login:ip:${clientIp(req)}`;
    const account = attemptedAccount(req);
    const accountKey = account ? `login:user:${account}` : null;

    const chaves = accountKey ? [ipKey, accountKey] : [ipKey];

    /**
     * Incrementa ANTES de processar, não depois.
     *
     * A versão que contava em `res.on("finish")` tinha uma janela de corrida:
     * a escrita era disparada sem await, então a requisição seguinte lia o
     * contador desatualizado. Num teste sequencial de 12 tentativas erradas,
     * as 12 passaram — o contador chegou a 12 no banco, mas sempre tarde
     * demais para bloquear. Um atacante disparando em paralelo nunca seria
     * barrado.
     *
     * Contando na entrada, o UPSERT atômico já devolve o valor definitivo e a
     * decisão é imediata. O login bem-sucedido zera as chaves logo abaixo,
     * então o usuário legítimo não acumula penalidade.
     */
    const [porIp, porConta] = await Promise.all([
      MAX_ATTEMPTS_PER_IP > 0 ? registrar(ipKey, WINDOW_MS) : null,
      accountKey && MAX_ATTEMPTS_PER_ACCOUNT > 0 ? registrar(accountKey, WINDOW_MS) : null,
    ]);

    // limite 0 = desligado (ver comentário sobre IP compartilhado no topo)
    const estourouIp = porIp !== null && porIp.contador > MAX_ATTEMPTS_PER_IP;
    const estourouConta = porConta !== null && porConta.contador > MAX_ATTEMPTS_PER_ACCOUNT;

    if (estourouIp || estourouConta) {
      const expiraEm = estourouConta && porConta ? porConta.expiraEm : porIp!.expiraEm;
      const seconds = segundosRestantes(expiraEm);
      const minutesLeft = Math.ceil(seconds / 60);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({
        error: `Muitas tentativas de login. Tente novamente em ${minutesLeft} minutos.`,
        minutesLeft,
      });
    }

    // Login bem-sucedido limpa o histórico de tentativas do usuário.
    res.on("finish", () => {
      if (res.statusCode < 400) void zerar(chaves);
    });

    next();
  });

  // --- Registro: limite generoso, só para conter criação em massa de contas ---
  app.use("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    if (MAX_REGISTRATIONS_PER_IP <= 0) return next();

    // Mesmo motivo do login: contar na entrada, com o valor já definitivo.
    const ipKey = `register:ip:${clientIp(req)}`;
    const { contador, expiraEm } = await registrar(ipKey, WINDOW_MS);

    if (contador > MAX_REGISTRATIONS_PER_IP) {
      res.setHeader("Retry-After", String(segundosRestantes(expiraEm)));
      return res.status(429).json({
        error: "Muitas tentativas de cadastro. Tente novamente mais tarde.",
      });
    }

    next();
  });

  // --- Rotas públicas: sem autenticação, precisam de teto próprio ---
  app.use("/api/public", async (req: Request, res: Response, next: NextFunction) => {
    const teto = envLimit("PUBLIC_MAX_PER_MINUTE", 60);
    if (teto <= 0) return next();

    const ipKey = `public:ip:${clientIp(req)}`;
    // Aqui incrementamos direto: toda requisição conta, então um único
    // UPSERT resolve leitura e escrita numa ida só ao banco.
    const { contador, expiraEm } = await registrar(ipKey, PUBLIC_WINDOW_MS);

    if (contador > teto) {
      res.setHeader("Retry-After", String(segundosRestantes(expiraEm)));
      return res.status(429).json({ error: "Muitas requisições. Aguarde um instante." });
    }

    next();
  });

  // Janelas vencidas não são lidas (o `espiar` as ignora), mas sem limpeza a
  // tabela cresceria para sempre.
  const sweeper = setInterval(() => {
    void limparVencidos();
  }, 5 * 60 * 1000);
  // não segura o processo aberto no shutdown
  sweeper.unref?.();
}
