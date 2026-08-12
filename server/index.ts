/**
 * Valida - Indique e Ganhe
 * ----------------------------------------------------------------------------
 * @application Indique e Ganhe
 * @client Grupo Santana
 * @version 1.0.0
 * @signature MX25-9D7F4B2E835CAC1170-AUTHCODE-PROTECTED
 * @copyright Todas as funcionalidades e o código-fonte desta aplicação são
 * propriedade exclusiva do Grupo Santana e estão protegidos por leis de
 * propriedade intelectual. Qualquer reprodução, modificação ou uso não
 * autorizado deste software constitui violação dos direitos autorais.
 * @date Maio 2025
 * ----------------------------------------------------------------------------
 */

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity, configureTrustProxy } from "./security";
import { assertTenantConfigured } from "./tenancy";

const app = express();

// Em produção, exige APP_TENANT explícito: a empresa das indicações não pode
// depender de um default silencioso nem do header Host do cliente.
assertTenantConfigured();

// Precisa vir antes de qualquer coisa que leia req.ip (rate limiting).
configureTrustProxy(app);

/**
 * CORS.
 *
 * O client e a API são servidos pelo MESMO processo Express, então em operação
 * normal nenhuma origem externa precisa de acesso e não emitimos cabeçalho algum.
 * A versão anterior refletia `req.headers.origin` de volta com
 * `Allow-Credentials: true`, ou seja: qualquer site na internet podia chamar a
 * API com o cookie de sessão da vítima.
 *
 * Para liberar origens externas (app mobile, outro front), liste-as em
 * CORS_ORIGINS separadas por vírgula.
 */
const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

function isAllowedOrigin(origin: string): boolean {
  if (configuredOrigins.includes(origin)) return true;
  // Em desenvolvimento, libera localhost em qualquer porta para facilitar testes.
  if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    // Origem influencia a resposta: sem isso, caches podem servir a resposta
    // de uma origem para outra.
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

/**
 * Limite de payload.
 *
 * O limite de 50mb valia para TODAS as rotas, inclusive as sem autenticação:
 * qualquer anônimo podia mandar 50 MB para /api/login e o servidor bufferizava
 * tudo na memória antes de descobrir quem era. Com algumas conexões
 * simultâneas isso derruba o processo por consumo de heap.
 *
 * Agora o padrão é pequeno e o limite grande vale só onde comprovante em base64
 * realmente trafega (definido em COMPROVANTE_LIMITE, aplicado nas rotas de
 * status/edição de indicação, depois da autenticação).
 */
app.use(express.json({ limit: process.env.JSON_LIMIT ?? '256kb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_LIMIT ?? '256kb' }));

// Depois dos parsers: o rate limiting de login precisa ler req.body.username
// para contar tentativas por conta, não só por IP.
setupSecurity(app);

/**
 * Log de requisições.
 *
 * A versão anterior serializava o CORPO da resposta de toda rota /api no log.
 * Isso despejava dados pessoais (CPF, chave PIX, telefone, saldo) e o retorno
 * do login em texto claro. O truncamento em 80 caracteres não resolvia — só
 * cortava o vazamento pela metade.
 *
 * Agora registramos apenas método, rota, status e duração.
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;
    log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

/**
 * Rede de segurança: nenhum hash de senha sai numa resposta.
 *
 * O objeto `user` é embutido por relação do Drizzle em ~32 consultas
 * (tickets, saques, indicações, fluxo de caixa...). Várias rotas lembravam de
 * fazer `const { password, ...resto } = user`, outras não — e a auditoria achou
 * pelo menos duas devolvendo o hash scrypt completo.
 *
 * Corrigir rota por rota não impede a próxima de esquecer. Este interceptor
 * remove a chave `password` em qualquer profundidade, uma vez só, no ponto por
 * onde toda resposta JSON passa. Nenhuma resposta legítima do sistema tem um
 * campo chamado `password`.
 */
const CAMPOS_PROIBIDOS = new Set(["password"]);

function removerCamposSensiveis(valor: unknown, profundidade = 0): unknown {
  // Guarda contra estruturas cíclicas/muito profundas
  if (profundidade > 12 || valor === null || typeof valor !== "object") {
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor.map((item) => removerCamposSensiveis(item, profundidade + 1));
  }

  // Não mexe em Date, Buffer e afins
  if (Object.getPrototypeOf(valor) !== Object.prototype) {
    return valor;
  }

  let copia: Record<string, unknown> | null = null;
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_PROIBIDOS.has(chave)) {
      copia ??= { ...(valor as Record<string, unknown>) };
      delete copia[chave];
      continue;
    }
    const limpo = removerCamposSensiveis(item, profundidade + 1);
    if (limpo !== item) {
      copia ??= { ...(valor as Record<string, unknown>) };
      copia[chave] = limpo;
    }
  }

  return copia ?? valor;
}

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();

  const jsonOriginal = res.json.bind(res);
  res.json = (corpo: unknown) => jsonOriginal(removerCamposSensiveis(corpo));
  next();
});

(async () => {
  const server = await registerRoutes(app);

  /**
   * Handler de erro final.
   *
   * Antes ele fazia `throw err` DEPOIS de responder — o erro voltava para o
   * Express com a resposta já enviada, produzindo "Cannot set headers after
   * they are sent" e derrubando a conexão. E devolvia `err.message` cru ao
   * cliente, expondo detalhes internos (mensagens do Postgres, caminhos, etc).
   */
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;

    console.error(`[ERROR] ${req.method} ${req.path} -> ${status}`, err);

    if (res.headersSent) return;

    // 4xx: mensagem própria da aplicação pode ir ao cliente.
    // 5xx: mensagem genérica — o detalhe fica no log do servidor.
    const message =
      status < 500 ? err?.message || "Requisição inválida" : "Erro interno do servidor";

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Porta configurável (padrão 5000). Serve tanto a API quanto o client.
  const port = Number(process.env.PORT ?? 5000);
  const host = process.env.HOST ?? "0.0.0.0";
  server.listen({
    port,
    host,
    // SO_REUSEPORT não é suportado no Windows; só habilita fora dele.
    reusePort: process.platform !== "win32",
  }, () => {
    log(`serving on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  });
})();
