import { sql, lte, inArray } from "drizzle-orm";
import { db } from "@db";
import { rateLimits } from "@shared/schema";

/**
 * Armazenamento dos contadores de rate limiting.
 *
 * Antes era um `Map` em memória. Dois problemas sérios em produção:
 *
 *  - com mais de uma instância da aplicação, cada uma tinha o próprio contador.
 *    Duas instâncias = o dobro de tentativas permitidas; N instâncias = N vezes.
 *    O limite virava decorativo exatamente quando mais importa.
 *  - qualquer restart (deploy, crash, autoscaling) zerava tudo, inclusive
 *    bloqueios ativos. Bastava esperar um deploy para reiniciar um ataque.
 *
 * Agora vive no Postgres, que a aplicação já usa — nenhuma infraestrutura nova.
 *
 * FALHA ABERTA por decisão consciente: se o banco estiver indisponível, as
 * requisições passam em vez de serem bloqueadas. Numa queda de banco o login
 * não funcionaria de qualquer forma (precisa ler o usuário), então falhar
 * fechado só transformaria indisponibilidade de banco em indisponibilidade
 * total, sem ganho de segurança.
 */

export interface ContadorJanela {
  contador: number;
  expiraEm: Date;
}

const ZERADO: ContadorJanela = { contador: 0, expiraEm: new Date(0) };

function aoFalhar(operacao: string, erro: unknown): void {
  console.error(
    `[RATE_LIMIT] Falha em ${operacao} — liberando a requisição (falha aberta):`,
    erro instanceof Error ? erro.message : erro,
  );
}

/**
 * Incrementa de forma ATÔMICA e devolve o novo valor.
 *
 * O UPSERT resolve num único statement tanto o incremento quanto a virada da
 * janela — sem ler-e-depois-escrever, que sob concorrência perderia contagens
 * (dois pedidos simultâneos leriam o mesmo valor e gravariam o mesmo +1).
 */
export async function registrar(chave: string, janelaMs: number): Promise<ContadorJanela> {
  const segundos = Math.max(1, Math.round(janelaMs / 1000));

  try {
    const [linha] = await db
      .insert(rateLimits)
      .values({
        chave,
        contador: 1,
        janelaExpiraEm: sql`now() + make_interval(secs => ${segundos})` as any,
      })
      .onConflictDoUpdate({
        target: rateLimits.chave,
        set: {
          contador: sql`CASE
            WHEN ${rateLimits.janelaExpiraEm} <= now() THEN 1
            ELSE ${rateLimits.contador} + 1
          END`,
          janelaExpiraEm: sql`CASE
            WHEN ${rateLimits.janelaExpiraEm} <= now() THEN now() + make_interval(secs => ${segundos})
            ELSE ${rateLimits.janelaExpiraEm}
          END`,
        },
      })
      .returning();

    return linha
      ? { contador: linha.contador, expiraEm: new Date(linha.janelaExpiraEm) }
      : ZERADO;
  } catch (erro) {
    aoFalhar("registrar", erro);
    return ZERADO;
  }
}

/**
 * Zera o contador — usado quando o login dá certo.
 *
 * Usa `inArray` e não `sql\`... = ANY(${chaves})\``: o template do Drizzle
 * vincula o array JS como um parâmetro único que o Postgres não compara com
 * text[], então o DELETE rodava sem erro e apagava ZERO linhas — falha
 * silenciosa, o contador do usuário legítimo nunca era limpo.
 */
export async function zerar(chaves: string[]): Promise<void> {
  if (chaves.length === 0) return;
  try {
    await db.delete(rateLimits).where(inArray(rateLimits.chave, chaves));
  } catch (erro) {
    aoFalhar("zerar", erro);
  }
}

/** Remove janelas vencidas. Chamado periodicamente. */
export async function limparVencidos(): Promise<void> {
  try {
    await db.delete(rateLimits).where(lte(rateLimits.janelaExpiraEm, new Date()));
  } catch (erro) {
    aoFalhar("limparVencidos", erro);
  }
}
