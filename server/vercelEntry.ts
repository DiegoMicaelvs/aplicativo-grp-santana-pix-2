import type { IncomingMessage, ServerResponse } from "http";
import { appPronto } from "./index";

/**
 * Entrypoint da função serverless na Vercel.
 *
 * Este arquivo NÃO é a função em si: o build (`npm run build:vercel`) o
 * transforma, via esbuild, no arquivo único `api/index.js`. O motivo é que o
 * builder da Vercel transpila TypeScript sem reescrever imports relativos, e em
 * ESM `import "../server/index"` sem extensão não resolve — a função morria com
 * ERR_MODULE_NOT_FOUND antes de atender qualquer requisição.
 *
 * Bundlando, todo o código do servidor vira um arquivo só e não sobra nenhum
 * import relativo para o Node resolver em runtime.
 *
 * O app Express é montado uma vez por instância (a promise resolve no primeiro
 * cold start e fica em cache no módulo). Cada requisição só espera a promise já
 * resolvida — não remonta rotas nem reabre o pool de conexões.
 *
 * O client é servido como estático pelo CDN da Vercel (ver vercel.json), então
 * esta função atende apenas /api e as rotas de redirecionamento de link.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPronto;
  return (app as any)(req, res);
}
