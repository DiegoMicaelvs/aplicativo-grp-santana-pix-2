/**
 * Log da aplicação.
 *
 * Vive fora de server/vite.ts de propósito: aquele módulo importa o pacote
 * `vite`, que é devDependency e NÃO existe no runtime serverless da Vercel.
 * Como `log` é usado no caminho normal de requisição, importá-lo de lá
 * arrastava o `vite` junto e derrubava a função inteira no cold start.
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}
