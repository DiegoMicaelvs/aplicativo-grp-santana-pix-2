import { timingSafeEqual } from "crypto";

/**
 * Comparação de segredos em tempo constante.
 *
 * `a !== b` sai no primeiro byte diferente, o que vaza o tamanho do prefixo
 * correto para quem consegue medir o tempo de resposta.
 *
 * Também trata o caso perigoso de valores ausentes: comparar `undefined` com
 * `undefined` com `!==` dá "iguais" e transforma uma checagem de autenticação
 * em porta aberta quando a variável de ambiente não foi definida.
 */
export function safeCompare(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b) return false;

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    // Compara mesmo assim para não encurtar o caminho e revelar o tamanho.
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
