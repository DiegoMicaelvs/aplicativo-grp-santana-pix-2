import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "../../server/storage";
import { db } from "@db";
import { auditLog } from "@shared/schema";
import { limpar, criarEmpresa, criarUsuario, criarIndicacao } from "../helpers/fixtures";

/**
 * Bloqueio automático por fraude.
 *
 * Regra: acima de 10 indicações marcadas como falsas, o indicador é bloqueado
 * e não consegue mais indicar. "Mais de 10" = bloqueia na 11ª, não na 10ª.
 */

const LIMITE = 10;

let empresa: any;
let promotor: any;
let indicador: any;

async function estaAtivo(userId: number): Promise<boolean> {
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
    columns: { isActive: true },
  });
  return u?.isActive ?? false;
}

async function marcarFalsas(userId: number, quantas: number) {
  for (let i = 0; i < quantas; i++) {
    const ind = await criarIndicacao({
      userId,
      companyId: empresa.id,
      promoterId: promotor.id,
    });
    await storage.updateReferralStatus(ind.id, "false", "fraude", promotor.id);
  }
}

beforeEach(async () => {
  await limpar();
  empresa = await criarEmpresa();
  promotor = await criarUsuario({ role: "promotor" });
  indicador = await criarUsuario({ role: "indicador", promoterId: promotor.id });
});

describe("limiar do bloqueio", () => {
  it("com 10 falsas o indicador continua ativo", async () => {
    await marcarFalsas(indicador.id, LIMITE);
    expect(await estaAtivo(indicador.id)).toBe(true);
  });

  it("na 11ª falsa o indicador é bloqueado", async () => {
    await marcarFalsas(indicador.id, LIMITE + 1);
    expect(await estaAtivo(indicador.id)).toBe(false);
  });

  it("continua bloqueado com mais falsas depois", async () => {
    await marcarFalsas(indicador.id, LIMITE + 3);
    expect(await estaAtivo(indicador.id)).toBe(false);
  });
});

describe("escopo do bloqueio", () => {
  it("não afeta outro indicador da mesma equipe", async () => {
    const colega = await criarUsuario({ role: "indicador", promoterId: promotor.id });

    await marcarFalsas(indicador.id, LIMITE + 1);

    expect(await estaAtivo(indicador.id)).toBe(false);
    expect(await estaAtivo(colega.id)).toBe(true);
  });

  it("não bloqueia o promotor", async () => {
    await marcarFalsas(indicador.id, LIMITE + 1);
    expect(await estaAtivo(promotor.id)).toBe(true);
  });

  it("indicações validadas não contam para o limite", async () => {
    for (let i = 0; i < 15; i++) {
      const ind = await criarIndicacao({
        userId: indicador.id,
        companyId: empresa.id,
        promoterId: promotor.id,
      });
      await storage.updateReferralStatus(ind.id, "validated", "ok", promotor.id);
    }
    expect(await estaAtivo(indicador.id)).toBe(true);
  });
});

describe("rastreabilidade", () => {
  it("o bloqueio fica registrado na auditoria com a contagem", async () => {
    await marcarFalsas(indicador.id, LIMITE + 1);

    const registros = await db.query.auditLog.findMany({
      where: (t, { eq }) => eq(t.action, "auto_block_fraud"),
    });

    expect(registros).toHaveLength(1);
    expect(registros[0].entityId).toBe(indicador.id);
    expect(registros[0].details).toContain("11");
  });

  it("não registra o bloqueio duas vezes", async () => {
    await marcarFalsas(indicador.id, LIMITE + 4);

    const registros = await db.query.auditLog.findMany({
      where: (t, { eq }) => eq(t.action, "auto_block_fraud"),
    });
    expect(registros).toHaveLength(1);
  });
});
