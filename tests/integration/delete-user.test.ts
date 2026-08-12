import { describe, it, expect, beforeEach } from "vitest";
import { storage, UserHasFinancialHistoryError } from "../../server/storage";
import { db } from "@db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  limpar,
  criarEmpresa,
  criarUsuario,
  criarIndicacao,
} from "../helpers/fixtures";

/**
 * Exclusão física de usuário.
 *
 * A versão anterior deletava as indicações do usuário sem tratar quem as
 * referencia, e o DELETE final batia numa FK — a operação inteira falhava
 * com 500 sempre que o usuário tinha histórico.
 *
 * Regra deste sistema de dinheiro: usuário com histórico financeiro NÃO é
 * excluído (destruiria a trilha de auditoria); é desativado. Só usuário limpo
 * é removido de fato.
 */

let empresa: any;

async function existe(userId: number): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true } });
  return !!u;
}

beforeEach(async () => {
  await limpar();
  empresa = await criarEmpresa();
});

describe("usuário limpo", () => {
  it("é excluído sem erro", async () => {
    const u = await criarUsuario({ role: "indicador" });
    await storage.deleteUser(u.id);
    expect(await existe(u.id)).toBe(false);
  });

  it("com indicação sem comissão ainda é excluído (e leva a indicação junto)", async () => {
    const u = await criarUsuario({ role: "indicador" });
    await criarIndicacao({ userId: u.id, companyId: empresa.id });

    await storage.deleteUser(u.id);

    expect(await existe(u.id)).toBe(false);
  });
});

describe("usuário com histórico financeiro", () => {
  it("recusa exclusão quando há comissão creditada", async () => {
    const promotor = await criarUsuario({ role: "promotor" });
    const indicador = await criarUsuario({ role: "indicador", promoterId: promotor.id });
    const ind = await criarIndicacao({
      userId: indicador.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    await expect(storage.deleteUser(indicador.id)).rejects.toBeInstanceOf(
      UserHasFinancialHistoryError,
    );

    // Continua existindo — nada foi apagado
    expect(await existe(indicador.id)).toBe(true);
  });

  it("recusa exclusão quando há saque", async () => {
    const u = await criarUsuario({ role: "indicador", balance: "50.00" });
    await storage.createWithdrawalRequest({
      userId: u.id,
      amount: 20,
      pixKey: u.pixKey,
      cpfKey: u.cpf,
      requestType: "indicador",
    });

    await expect(storage.deleteUser(u.id)).rejects.toBeInstanceOf(
      UserHasFinancialHistoryError,
    );
    expect(await existe(u.id)).toBe(true);
  });

  it("recusa exclusão de promotor com saldo devido, mesmo sem indicação própria", async () => {
    // O saldo pode vir de commissionPromoter em indicações de TERCEIROS —
    // não aparece em referrals.userId. A barreira precisa olhar users.balance.
    const promotor = await criarUsuario({ role: "promotor", balance: "40.00" });

    await expect(storage.deleteUser(promotor.id)).rejects.toBeInstanceOf(
      UserHasFinancialHistoryError,
    );
    expect(await existe(promotor.id)).toBe(true);
  });
});

describe("vínculos com terceiros", () => {
  it("excluir um indicador limpo não derruba o promotor", async () => {
    const promotor = await criarUsuario({ role: "promotor" });
    const indicador = await criarUsuario({ role: "indicador", promoterId: promotor.id });

    await storage.deleteUser(indicador.id);

    expect(await existe(indicador.id)).toBe(false);
    expect(await existe(promotor.id)).toBe(true);
  });

  it("indicações de OUTRO usuário que apontam para o excluído ficam com o campo nulo, não somem", async () => {
    const promotor = await criarUsuario({ role: "promotor" });
    const outroIndicador = await criarUsuario({ role: "indicador", promoterId: promotor.id });
    const ind = await criarIndicacao({
      userId: outroIndicador.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });

    // promotor está limpo (sem comissão/saque próprios) -> pode ser excluído
    await storage.deleteUser(promotor.id);

    const aindaExiste = await db.query.referrals.findFirst({
      where: (t, { eq }) => eq(t.id, ind.id),
      columns: { id: true, promoterId: true },
    });
    expect(aindaExiste).toBeDefined();
    expect(aindaExiste!.promoterId).toBeNull();
  });

  it("indicação criada para terceiro NÃO é apagada; createdBy migra para o dono", async () => {
    // admin limpo cria indicação em nome de outro indicador
    const admin = await criarUsuario({ role: "admin" });
    const dono = await criarUsuario({ role: "indicador" });
    const ind = await criarIndicacao({ userId: dono.id, companyId: empresa.id });
    // marca o admin como criador
    await db.update((await import("@shared/schema")).referrals)
      .set({ createdBy: admin.id })
      .where(eq((await import("@shared/schema")).referrals.id, ind.id));

    await storage.deleteUser(admin.id);

    const preservada = await db.query.referrals.findFirst({
      where: (t, { eq }) => eq(t.id, ind.id),
      columns: { id: true, createdBy: true, userId: true },
    });
    expect(preservada).toBeDefined();
    // registro do dono preservado; createdBy reatribuído a ele
    expect(preservada!.userId).toBe(dono.id);
    expect(preservada!.createdBy).toBe(dono.id);
  });
});
