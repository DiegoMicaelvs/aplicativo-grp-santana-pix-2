/**
 * Ponto de entrada da função serverless na Vercel.
 *
 * Este arquivo é VERSIONADO e propositalmente mínimo. O código de verdade está
 * em `api/_servidor.js`, que o build gera com esbuild a partir de
 * server/vercelEntry.ts (ver `npm run build:vercel`).
 *
 * Por que essa separação:
 *
 * A Vercel valida o padrão declarado em `functions` (vercel.json) ANTES de
 * rodar o buildCommand. Quando o bundle era gerado direto em `api/index.js` e
 * ficava no .gitignore, o arquivo não existia no clone do GitHub e todo deploy
 * automático morria com "The pattern api/index.js doesn't match any Serverless
 * Functions inside the api directory". Pelo CLI passava, porque ele envia o
 * arquivo já gerado na máquina local — ou seja, publicava o bundle do
 * desenvolvedor em vez do construído no servidor.
 *
 * Versionar o bundle inteiro resolveria a validação, mas cria uma armadilha
 * pior: um push que mude `server/` sem rebuildar publicaria o bundle antigo sem
 * nenhum aviso. Com o shim, o que é versionado nunca muda e o que roda é sempre
 * recém-construído.
 *
 * O prefixo `_` faz a Vercel ignorar `_servidor.js` como rota própria; ele entra
 * no pacote da função por este import.
 */
export { default } from "./_servidor.js";
