import { describe, it, expect, beforeEach } from "vitest";
import { registrar, zerar, limparVencidos } from "../../server/rateLimitStore";
import { db } from "@db";
import { rateLimits } from "@shared/schema";
import { limpar } from "../helpers/fixtures";

/**
 * Contadores de rate limiting no Postgres.
 *
 * Antes viviam num Map em memória: com N instâncias da aplicação o limite
 * valia N vezes, e qualquer restart zerava até os bloqueios ativos.
 */

const JANELA = 60_000;

async function contadorDe(chave: string): Promise<number | null> {
  const linha = await db.query.rateLimits.findFirst({
    where: (t, { eq }) => eq(t.chave, chave),
  });
  return linha?.contador ?? null;
}

beforeEach(async () => {
  await limpar();
});

describe("contagem", () => {
  it("primeira ocorrência começa em 1", async () => {
    const r = await registrar("teste:a", JANELA);
    expect(r.contador).toBe(1);
  });

  it("incrementos sucessivos somam", async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await registrar("teste:b", JANELA);
      expect(r.contador).toBe(i);
    }
  });

  it("chaves diferentes têm contadores independentes", async () => {
    await registrar("teste:c1", JANELA);
    await registrar("teste:c1", JANELA);
    await registrar("teste:c2", JANELA);

    expect(await contadorDe("teste:c1")).toBe(2);
    expect(await contadorDe("teste:c2")).toBe(1);
  });

  it("a janela de expiração é devolvida no futuro", async () => {
    const r = await registrar("teste:d", JANELA);
    expect(r.expiraEm.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("atomicidade", () => {
  it("incrementos simultâneos não perdem contagem", async () => {
    // Com ler-e-depois-escrever, chamadas concorrentes leriam o mesmo valor e
    // gravariam o mesmo +1 — o contador ficaria muito abaixo do real e o
    // limite nunca dispararia sob ataque paralelo.
    const N = 50;
    await Promise.all(Array.from({ length: N }, () => registrar("teste:corrida", JANELA)));

    expect(await contadorDe("teste:corrida")).toBe(N);
  });

  it("cada chamada concorrente recebe um número distinto", async () => {
    const N = 30;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => registrar("teste:distintos", JANELA)),
    );

    const numeros = resultados.map((r) => r.contador).sort((a, b) => a - b);
    expect(numeros).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });
});

describe("janela expirada", () => {
  it("contador reinicia quando a janela vence", async () => {
    await registrar("teste:expira", JANELA);
    await registrar("teste:expira", JANELA);
    expect(await contadorDe("teste:expira")).toBe(2);

    // Empurra a janela para o passado
    await db
      .update(rateLimits)
      .set({ janelaExpiraEm: new Date(Date.now() - 1000) })
      .where((await import("drizzle-orm")).eq(rateLimits.chave, "teste:expira"));

    const r = await registrar("teste:expira", JANELA);
    expect(r.contador).toBe(1);
    expect(r.expiraEm.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("zerar", () => {
  it("remove os contadores das chaves informadas", async () => {
    await registrar("teste:z1", JANELA);
    await registrar("teste:z2", JANELA);
    await registrar("teste:z3", JANELA);

    await zerar(["teste:z1", "teste:z2"]);

    // Bug real: com `sql\`chave = ANY(${array})\`` o DELETE rodava sem erro e
    // apagava ZERO linhas — o contador do usuário legítimo nunca era limpo.
    expect(await contadorDe("teste:z1")).toBeNull();
    expect(await contadorDe("teste:z2")).toBeNull();
    expect(await contadorDe("teste:z3")).toBe(1);
  });

  it("lista vazia não apaga nada", async () => {
    await registrar("teste:z4", JANELA);
    await zerar([]);
    expect(await contadorDe("teste:z4")).toBe(1);
  });
});

describe("limpeza de vencidos", () => {
  it("remove só as janelas vencidas", async () => {
    await registrar("teste:v-vencido", JANELA);
    await registrar("teste:v-ativo", JANELA);

    const { eq } = await import("drizzle-orm");
    await db
      .update(rateLimits)
      .set({ janelaExpiraEm: new Date(Date.now() - 1000) })
      .where(eq(rateLimits.chave, "teste:v-vencido"));

    await limparVencidos();

    expect(await contadorDe("teste:v-vencido")).toBeNull();
    expect(await contadorDe("teste:v-ativo")).toBe(1);
  });
});

describe("persistência", () => {
  it("o contador sobrevive fora do processo — está no banco", async () => {
    // É esta propriedade que o Map em memória não tinha: um restart (deploy,
    // crash, autoscaling) zerava até bloqueios ativos.
    await registrar("teste:persistente", JANELA);
    await registrar("teste:persistente", JANELA);

    const linha = await db.query.rateLimits.findFirst({
      where: (t, { eq }) => eq(t.chave, "teste:persistente"),
    });

    expect(linha).toBeDefined();
    expect(linha!.contador).toBe(2);
    expect(new Date(linha!.janelaExpiraEm).getTime()).toBeGreaterThan(Date.now());
  });
});
