import { describe, it, expect, beforeEach } from "vitest";
import { storage, InsufficientBalanceError } from "../../server/storage";
import { db } from "@db";
import { withdrawalRequests } from "@shared/schema";
import { limpar, criarUsuario, saldoDe } from "../helpers/fixtures";

/**
 * Saque.
 *
 * O ponto crítico é o débito: a rota lia o saldo, validava e só depois
 * debitava. Dois pedidos simultâneos liam o mesmo saldo, os dois passavam e
 * os dois eram debitados — saldo negativo e dinheiro sacado a mais. Um duplo
 * clique no botão bastava.
 */

let usuario: any;

async function saquesDe(userId: number) {
  return db.query.withdrawalRequests.findMany({
    where: (t, { eq }) => eq(t.userId, userId),
  });
}

beforeEach(async () => {
  await limpar();
  usuario = await criarUsuario({ role: "indicador", balance: "100.00" });
});

describe("débito atômico", () => {
  it("saque dentro do saldo debita o valor", async () => {
    await storage.createWithdrawalRequest({
      userId: usuario.id,
      amount: 30,
      pixKey: usuario.pixKey,
      cpfKey: usuario.cpf,
      requestType: "indicador",
    });

    expect(await saldoDe(usuario.id)).toBe(70);
  });

  it("saque acima do saldo é recusado e não debita nada", async () => {
    await expect(
      storage.createWithdrawalRequest({
        userId: usuario.id,
        amount: 500,
        pixKey: usuario.pixKey,
        cpfKey: usuario.cpf,
        requestType: "indicador",
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    expect(await saldoDe(usuario.id)).toBe(100);
    expect(await saquesDe(usuario.id)).toHaveLength(0);
  });

  it("saque recusado não deixa registro órfão", async () => {
    // O INSERT e o débito estão na mesma transação: se o débito não passa,
    // o pedido de saque não pode existir.
    await expect(
      storage.createWithdrawalRequest({
        userId: usuario.id,
        amount: 999,
        pixKey: usuario.pixKey,
        cpfKey: usuario.cpf,
        requestType: "indicador",
      }),
    ).rejects.toThrow();

    expect(await saquesDe(usuario.id)).toHaveLength(0);
  });
});

describe("concorrência — o double-spend", () => {
  it("pedidos simultâneos nunca sacam mais que o saldo", async () => {
    // Saldo R$100; 10 pedidos de valores distintos somando R$155.
    const valores = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    const resultados = await Promise.allSettled(
      valores.map((v) =>
        storage.createWithdrawalRequest({
          userId: usuario.id,
          amount: v,
          pixKey: usuario.pixKey,
          cpfKey: usuario.cpf,
          requestType: "indicador",
        }),
      ),
    );

    const aceitos = resultados.filter((r) => r.status === "fulfilled").length;
    const saques = await saquesDe(usuario.id);
    const totalSacado = saques.reduce((s, w) => s + Number(w.amount), 0);
    const saldoFinal = await saldoDe(usuario.id);

    expect(saques).toHaveLength(aceitos);
    // A invariante: o que saiu + o que sobrou = o que havia
    expect(totalSacado + saldoFinal).toBe(100);
    expect(totalSacado).toBeLessThanOrEqual(100);
    expect(saldoFinal).toBeGreaterThanOrEqual(0);
  });

  it("saldo nunca fica negativo mesmo com muitos pedidos do mesmo valor", async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        storage.createWithdrawalRequest({
          userId: usuario.id,
          amount: 40,
          pixKey: usuario.pixKey,
          cpfKey: usuario.cpf,
          requestType: "indicador",
        }),
      ),
    );

    const aceitos = resultados.filter((r) => r.status === "fulfilled").length;
    expect(aceitos).toBeLessThanOrEqual(2); // R$100 / R$40
    expect(await saldoDe(usuario.id)).toBeGreaterThanOrEqual(0);
  });
});

describe("transição de status do saque", () => {
  it("rejeitar devolve o valor ao saldo", async () => {
    const saque = await storage.createWithdrawalRequest({
      userId: usuario.id,
      amount: 40,
      pixKey: usuario.pixKey,
      cpfKey: usuario.cpf,
      requestType: "indicador",
    });
    expect(await saldoDe(usuario.id)).toBe(60);

    await storage.updateWithdrawalStatus(saque.id, "rejected", usuario.id, "nao confere");

    expect(await saldoDe(usuario.id)).toBe(100);
  });

  it("rejeitar duas vezes NÃO devolve o valor duas vezes", async () => {
    // A "idempotência" era check-then-act sem guarda: duas chamadas
    // concorrentes devolviam o valor 2x — dinheiro criado do nada.
    const saque = await storage.createWithdrawalRequest({
      userId: usuario.id,
      amount: 40,
      pixKey: usuario.pixKey,
      cpfKey: usuario.cpf,
      requestType: "indicador",
    });

    await storage.updateWithdrawalStatus(saque.id, "rejected", usuario.id, "1");
    await storage.updateWithdrawalStatus(saque.id, "rejected", usuario.id, "2");

    expect(await saldoDe(usuario.id)).toBe(100);
  });

  it("rejeições simultâneas devolvem o valor uma vez só", async () => {
    const saque = await storage.createWithdrawalRequest({
      userId: usuario.id,
      amount: 40,
      pixKey: usuario.pixKey,
      cpfKey: usuario.cpf,
      requestType: "indicador",
    });

    await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        storage.updateWithdrawalStatus(saque.id, "rejected", usuario.id, "corrida"),
      ),
    );

    expect(await saldoDe(usuario.id)).toBe(100);
  });

  it("pagar não lança duas saídas no fluxo de caixa", async () => {
    const saque = await storage.createWithdrawalRequest({
      userId: usuario.id,
      amount: 40,
      pixKey: usuario.pixKey,
      cpfKey: usuario.cpf,
      requestType: "indicador",
    });

    await storage.updateWithdrawalStatus(saque.id, "approved", usuario.id, "ok");
    await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        storage.updateWithdrawalStatus(saque.id, "paid", usuario.id, "pago"),
      ),
    );

    const lancamentos = await storage.getCashFlowEntries();
    const doSaque = lancamentos.filter((l: any) => l.relatedWithdrawalId === saque.id);
    expect(doSaque).toHaveLength(1);
  });
});

describe("fluxo de caixa sob concorrência", () => {
  it("saldo corrente permanece coerente com lançamentos simultâneos", async () => {
    // createCashFlowEntry lia o último saldo e inseria o novo — duas escritas
    // simultâneas liam o MESMO valor anterior e o extrato passava a mentir.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        storage.createCashFlowEntry({
          type: "inflow",
          amount: 10,
          description: `entrada ${i}`,
          createdBy: usuario.id,
        }),
      ),
    );

    const lancamentos = await storage.getCashFlowEntries();
    expect(lancamentos).toHaveLength(10);

    // O saldo do último lançamento tem de ser a soma de todas as entradas
    expect(await storage.getCurrentBalance()).toBe(100);
  });
});
