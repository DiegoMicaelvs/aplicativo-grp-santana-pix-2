import { describe, it, expect } from "vitest";
import {
  repartirPool,
  clampComissao,
  POOL_VALIDATED,
  POOL_CONVERTED,
} from "../../server/storage";

/**
 * Rateio de comissão.
 *
 * Duas invariantes valem para QUALQUER entrada, inclusive absurda:
 *   1. nenhuma parcela negativa — parcela negativa vira débito no saldo de
 *      quem não devia nada;
 *   2. a soma das três parcelas é exatamente o pool — nem centavo criado,
 *      nem centavo sumido.
 *
 * O bug real que motivou estes testes: `alocaçãoSupervisor - takeIndicador`
 * ficava negativo quando o promotor alocava ao supervisor menos do que o
 * indicador já levava, e o supervisor era DEBITADO por um lead da equipe dele.
 */

function somaDe(r: { indicador: number; supervisor: number; promotor: number }) {
  return r.indicador + r.supervisor + r.promotor;
}

describe("repartirPool — casos normais", () => {
  it("sem supervisor: indicador leva o take, promotor fica com o resto", () => {
    const r = repartirPool(POOL_VALIDATED, 3, null);
    expect(r).toEqual({ indicador: 3, supervisor: 0, promotor: 1 });
  });

  it("pool de conversão sem supervisor: 50 para o indicador, 10 para o promotor", () => {
    const r = repartirPool(POOL_CONVERTED, 50, null);
    expect(r).toEqual({ indicador: 50, supervisor: 0, promotor: 10 });
  });

  it("com supervisor: alocação cobre o indicador e o supervisor fica com a diferença", () => {
    // promotor alocou R$3,50 ao supervisor; indicador leva R$3
    const r = repartirPool(POOL_VALIDATED, 3, 3.5);
    expect(r.indicador).toBe(3);
    expect(r.supervisor).toBeCloseTo(0.5, 10);
    expect(r.promotor).toBeCloseTo(0.5, 10);
    expect(somaDe(r)).toBeCloseTo(POOL_VALIDATED, 10);
  });
});

describe("repartirPool — o bug da parcela negativa", () => {
  it("alocação MENOR que o take do indicador não debita o supervisor", () => {
    // Antes: supervisor = 2 - 3 = -1  (débito no saldo dele)
    const r = repartirPool(POOL_VALIDATED, 3, 2);
    expect(r.supervisor).toBe(0);
    expect(r.supervisor).toBeGreaterThanOrEqual(0);
    expect(somaDe(r)).toBe(POOL_VALIDATED);
  });

  it("alocação MAIOR que o pool não deixa o promotor negativo", () => {
    const r = repartirPool(POOL_VALIDATED, 3, 99);
    expect(r.promotor).toBeGreaterThanOrEqual(0);
    expect(somaDe(r)).toBe(POOL_VALIDATED);
  });

  it("take do indicador maior que o pool é limitado ao pool", () => {
    const r = repartirPool(POOL_VALIDATED, 999, null);
    expect(r.indicador).toBe(POOL_VALIDATED);
    expect(r.promotor).toBe(0);
    expect(somaDe(r)).toBe(POOL_VALIDATED);
  });

  it("take negativo é tratado como zero", () => {
    const r = repartirPool(POOL_VALIDATED, -50, null);
    expect(r.indicador).toBe(0);
    expect(r.promotor).toBe(POOL_VALIDATED);
  });
});

describe("repartirPool — invariantes valem para qualquer entrada", () => {
  const pools = [POOL_VALIDATED, POOL_CONVERTED];
  const takes = [-10, 0, 0.01, 1, 3, 4, 50, 60, 1000];
  const alocacoes = [null, -5, 0, 1, 2, 3, 4, 30, 60, 1000];

  for (const pool of pools) {
    for (const take of takes) {
      for (const aloc of alocacoes) {
        it(`pool=${pool} take=${take} aloc=${aloc}`, () => {
          const r = repartirPool(pool, take, aloc);

          expect(r.indicador).toBeGreaterThanOrEqual(0);
          expect(r.supervisor).toBeGreaterThanOrEqual(0);
          expect(r.promotor).toBeGreaterThanOrEqual(0);
          expect(somaDe(r)).toBeCloseTo(pool, 10);
        });
      }
    }
  }
});

describe("clampComissao — nada de NaN chegando ao banco", () => {
  it("aceita número válido dentro do teto", () => {
    expect(clampComissao("2.50", POOL_VALIDATED)).toBe("2.50");
    expect(clampComissao(3, POOL_VALIDATED)).toBe("3.00");
  });

  it("limita ao teto do pool", () => {
    expect(clampComissao("999", POOL_VALIDATED)).toBe("4.00");
    expect(clampComissao("999", POOL_CONVERTED)).toBe("60.00");
  });

  it("nunca devolve negativo", () => {
    expect(clampComissao("-10", POOL_VALIDATED)).toBe("0.00");
  });

  it("rejeita NaN, Infinity e lixo", () => {
    // `NaN < 0` é falso E `NaN > 4` é falso: sem esta barreira o valor passava
    // por qualquer validação de faixa e o Postgres aceita 'NaN'::numeric.
    expect(clampComissao("abc", POOL_VALIDATED)).toBeNull();
    expect(clampComissao("NaN", POOL_VALIDATED)).toBeNull();
    expect(clampComissao("Infinity", POOL_VALIDATED)).toBeNull();
    expect(clampComissao(Number.NaN, POOL_VALIDATED)).toBeNull();
    expect(clampComissao(Number.POSITIVE_INFINITY, POOL_VALIDATED)).toBeNull();
  });

  it("ausência de valor vira null, não zero", () => {
    expect(clampComissao(undefined, POOL_VALIDATED)).toBeNull();
    expect(clampComissao(null, POOL_VALIDATED)).toBeNull();
    expect(clampComissao("", POOL_VALIDATED)).toBeNull();
  });
});
