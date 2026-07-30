import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "../../server/storage";
import { db } from "@db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  limpar,
  criarEmpresa,
  criarUsuario,
  criarIndicacao,
  saldoDe,
} from "../helpers/fixtures";

/**
 * Reatribuição de indicação para outro indicador.
 *
 * A comissão já creditada precisa migrar junto: sai do saldo de quem tinha,
 * entra no de quem passa a ter. Eram três escritas soltas (debita, credita,
 * grava a indicação) — falha no meio e o dinheiro evaporava.
 */

let empresa: any;
let promotor: any;
let antigo: any;
let novo: any;

async function totalEarningsDe(userId: number): Promise<number> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { totalEarnings: true },
  });
  return Number(u?.totalEarnings ?? 0);
}

beforeEach(async () => {
  await limpar();
  empresa = await criarEmpresa();
  promotor = await criarUsuario({ role: "promotor" });
  antigo = await criarUsuario({ role: "indicador", promoterId: promotor.id });
  novo = await criarUsuario({ role: "indicador", promoterId: promotor.id });
});

describe("transferência da comissão", () => {
  it("a comissão migra do indicador antigo para o novo", async () => {
    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    expect(await saldoDe(antigo.id)).toBe(3);
    expect(await saldoDe(novo.id)).toBe(0);

    await storage.updateReferral(ind.id, { userId: novo.id }, promotor.id);

    expect(await saldoDe(antigo.id)).toBe(0);
    expect(await saldoDe(novo.id)).toBe(3);
  });

  it("o dinheiro não some: a soma dos saldos é preservada", async () => {
    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    const antes = (await saldoDe(antigo.id)) + (await saldoDe(novo.id));
    await storage.updateReferral(ind.id, { userId: novo.id }, promotor.id);
    const depois = (await saldoDe(antigo.id)) + (await saldoDe(novo.id));

    expect(depois).toBe(antes);
  });

  it("reatribuir NÃO infla totalEarnings", async () => {
    // totalEarnings significa "total já sacado" e só muda quando um saque é
    // pago. A transferência passava updateEarnings=true e inflava o número
    // sem que existisse pagamento algum.
    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    await storage.updateReferral(ind.id, { userId: novo.id }, promotor.id);

    expect(await totalEarningsDe(novo.id)).toBe(0);
    expect(await totalEarningsDe(antigo.id)).toBe(0);
  });

  it("indicação sem comissão creditada não move saldo", async () => {
    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });

    await storage.updateReferral(ind.id, { userId: novo.id }, promotor.id);

    expect(await saldoDe(antigo.id)).toBe(0);
    expect(await saldoDe(novo.id)).toBe(0);
  });

  it("reatribuir também atualiza o promotor da indicação", async () => {
    const outroPromotor = await criarUsuario({ role: "promotor" });
    const deOutraEquipe = await criarUsuario({
      role: "indicador",
      promoterId: outroPromotor.id,
    });

    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });

    const atualizada = await storage.updateReferral(
      ind.id,
      { userId: deOutraEquipe.id },
      promotor.id,
    );

    expect(atualizada.userId).toBe(deOutraEquipe.id);
    expect(atualizada.promoterId).toBe(outroPromotor.id);
  });
});

describe("edição comum não mexe em dinheiro", () => {
  it("mudar cidade preserva os saldos", async () => {
    const ind = await criarIndicacao({
      userId: antigo.id,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);

    await storage.updateReferral(ind.id, { city: "Campinas" }, promotor.id);

    expect(await saldoDe(antigo.id)).toBe(3);
    expect(await saldoDe(promotor.id)).toBe(1);
  });
});
