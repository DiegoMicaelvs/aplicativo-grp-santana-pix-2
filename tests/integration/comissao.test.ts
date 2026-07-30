import { describe, it, expect, beforeEach } from "vitest";
import { storage, ConcurrentStatusChangeError } from "../../server/storage";
import {
  limpar,
  criarEmpresa,
  criarUsuario,
  criarIndicacao,
  saldoDe,
  comissoesDe,
} from "../helpers/fixtures";

/**
 * Crédito de comissão nas transições de status.
 *
 * Roda contra Postgres de verdade porque o que está sendo verificado é
 * comportamento transacional: UPDATE condicional com guarda de estado e
 * crédito atômico. Nada disso apareceria com banco mockado.
 */

let empresa: any;
let promotor: any;
let indicador: any;

beforeEach(async () => {
  await limpar();
  empresa = await criarEmpresa();
  promotor = await criarUsuario({ role: "promotor" });
  indicador = await criarUsuario({ role: "indicador", promoterId: promotor.id });
});

describe("valores do rateio", () => {
  it("validated paga R$3 ao indicador e R$1 ao promotor", async () => {
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    expect(await comissoesDe(ind.id)).toMatchObject({ indicador: 3, promotor: 1, supervisor: 0 });
    expect(await saldoDe(indicador.id)).toBe(3);
    expect(await saldoDe(promotor.id)).toBe(1);
  });

  it("converted paga o validado MAIS o bônus: R$53 e R$11", async () => {
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);
    await storage.updateReferralStatus(ind.id, "converted", "ok", promotor.id);

    expect(await comissoesDe(ind.id)).toMatchObject({ indicador: 53, promotor: 11 });
    expect(await saldoDe(indicador.id)).toBe(53);
    expect(await saldoDe(promotor.id)).toBe(11);
  });

  it("pending -> converted direto dá o MESMO resultado que passando por validated", async () => {
    // Antes o cálculo era incremental: sem passar por 'validated' o indicador
    // recebia só o bônus (R$50) e perdia os R$3 da validação.
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "converted", "ok", promotor.id);

    expect(await comissoesDe(ind.id)).toMatchObject({ indicador: 53, promotor: 11 });
    expect(await saldoDe(indicador.id)).toBe(53);
  });

  it("comissão customizada do indicador respeita o pool", async () => {
    const outro = await criarUsuario({
      role: "indicador",
      promoterId: promotor.id,
      commissionValidated: "2.50",
    });
    const ind = await criarIndicacao({ userId: outro.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    const c = await comissoesDe(ind.id);
    expect(c.indicador).toBe(2.5);
    expect(c.promotor).toBe(1.5); // resto do pool de R$4
    expect(c.indicador + c.promotor + c.supervisor).toBe(4);
  });
});

describe("supervisor nunca é debitado", () => {
  it("alocação do supervisor menor que o take do indicador não gera parcela negativa", async () => {
    // Supervisor alocado em R$2, indicador levando R$3.
    // Antes: supervisor = 2 - 3 = -1, debitado do saldo dele.
    const supervisor = await criarUsuario({
      role: "supervisor",
      promoterId: promotor.id,
      commissionValidated: "2.00",
      commissionConverted: "30.00",
    });
    const subordinado = await criarUsuario({
      role: "indicador",
      promoterId: promotor.id,
      teamSupervisorId: supervisor.id,
    });
    const ind = await criarIndicacao({ userId: subordinado.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    const c = await comissoesDe(ind.id);
    expect(c.supervisor).toBeGreaterThanOrEqual(0);
    expect(await saldoDe(supervisor.id)).toBeGreaterThanOrEqual(0);
    expect(c.indicador + c.promotor + c.supervisor).toBe(4);
  });
});

describe("idempotência: aplicar o mesmo status duas vezes", () => {
  it("validated repetido não paga duas vezes", async () => {
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "1", promotor.id);
    await storage.updateReferralStatus(ind.id, "validated", "2", promotor.id);

    expect(await saldoDe(indicador.id)).toBe(3);
    expect(await comissoesDe(ind.id)).toMatchObject({ indicador: 3, promotor: 1 });
  });

  it("converted repetido não debita os R$3 do validado", async () => {
    // Bug real: a segunda aplicação caía no ramo "veio de outro status",
    // gravava 50 no lugar de 53 e a diferença (-3) era debitada do indicador.
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "1", promotor.id);
    await storage.updateReferralStatus(ind.id, "converted", "2", promotor.id);
    const saldoAntes = await saldoDe(indicador.id);

    await storage.updateReferralStatus(ind.id, "converted", "3", promotor.id);

    expect(await saldoDe(indicador.id)).toBe(saldoAntes);
    expect(saldoAntes).toBe(53);
  });
});

describe("estorno ao reverter o status", () => {
  it("validated -> rejected devolve a comissão", async () => {
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);
    expect(await saldoDe(indicador.id)).toBe(3);

    await storage.updateReferralStatus(ind.id, "rejected", "falso", promotor.id);

    expect(await saldoDe(indicador.id)).toBe(0);
    expect(await saldoDe(promotor.id)).toBe(0);
  });

  it("converted -> false estorna os R$53 inteiros", async () => {
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    await storage.updateReferralStatus(ind.id, "converted", "ok", promotor.id);
    expect(await saldoDe(indicador.id)).toBe(53);

    await storage.updateReferralStatus(ind.id, "false", "fraude", promotor.id);

    expect(await saldoDe(indicador.id)).toBe(0);
  });
});

describe("concorrência", () => {
  it("N validações simultâneas creditam UMA vez só", async () => {
    // Sem a guarda de estado, todas liam status='pending', calculavam +3 e o
    // incremento atômico do saldo SOMAVA: R$24 para um lead de R$4.
    const ind = await criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id });

    const resultados = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        storage.updateReferralStatus(ind.id, "validated", "corrida", promotor.id),
      ),
    );

    /**
     * Cada chamada termina de um jeito aceitável: ou aplicou a transição
     * (inclusive como no-op, quando leu o status já atualizado), ou foi barrada
     * pela guarda de estado. O que NÃO pode acontecer é outro tipo de erro.
     *
     * A asserção forte é o dinheiro — quantas colisões o agendador provoca
     * varia entre execuções, mas o saldo é determinístico.
     */
    const conflitos = resultados.filter(
      (r) => r.status === "rejected" && r.reason instanceof ConcurrentStatusChangeError,
    ).length;
    const aplicadas = resultados.filter((r) => r.status === "fulfilled").length;
    expect(aplicadas + conflitos).toBe(8);

    expect(await saldoDe(indicador.id)).toBe(3);
    expect(await saldoDe(promotor.id)).toBe(1);
    expect(await comissoesDe(ind.id)).toMatchObject({ indicador: 3, promotor: 1 });
  });

  it("rajadas repetidas nunca criam dinheiro", async () => {
    // Repete a corrida várias vezes: quantas colisões acontecem varia, mas o
    // total pago tem de ser exatamente uma comissão por indicação.
    for (let rodada = 0; rodada < 5; rodada++) {
      const ind = await criarIndicacao({
        userId: indicador.id,
        companyId: empresa.id,
        promoterId: promotor.id,
      });
      await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          storage.updateReferralStatus(ind.id, "validated", "rajada", promotor.id),
        ),
      );
    }

    expect(await saldoDe(indicador.id)).toBe(15); // 5 indicações x R$3
    expect(await saldoDe(promotor.id)).toBe(5); // 5 x R$1
  });

  it("indicações diferentes em paralelo somam corretamente", async () => {
    const indicacoes = await Promise.all(
      Array.from({ length: 5 }, () =>
        criarIndicacao({ userId: indicador.id, companyId: empresa.id, promoterId: promotor.id }),
      ),
    );

    await Promise.all(
      indicacoes.map((i) => storage.updateReferralStatus(i.id, "validated", "ok", promotor.id)),
    );

    expect(await saldoDe(indicador.id)).toBe(15); // 5 x R$3
    expect(await saldoDe(promotor.id)).toBe(5); // 5 x R$1
  });
});
