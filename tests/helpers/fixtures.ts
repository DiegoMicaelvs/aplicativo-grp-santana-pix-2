import { db, pool } from "@db";
import { users, companies, referrals } from "@shared/schema";
import type { UserRole } from "@shared/schema";
import { limparTabelas } from "../setup-db";

/**
 * Fixtures dos testes de integração.
 *
 * Cada teste monta o próprio cenário a partir de um banco limpo — nada de
 * depender de seed compartilhado, que faz um teste quebrar por causa de outro.
 */

let sequencia = 0;
function proximo(): number {
  return ++sequencia;
}

export async function limpar(): Promise<void> {
  await limparTabelas(pool);
}

export async function criarEmpresa(nome = "Empresa Teste") {
  const [empresa] = await db
    .insert(companies)
    .values({ name: `${nome} ${proximo()}`, isActive: true })
    .returning();
  return empresa;
}

interface OpcoesUsuario {
  role?: UserRole;
  commissionValidated?: string | null;
  commissionConverted?: string | null;
  promoterId?: number;
  teamSupervisorId?: number;
  balance?: string;
  isActive?: boolean;
}

export async function criarUsuario(opcoes: OpcoesUsuario = {}) {
  const n = proximo();
  const [usuario] = await db
    .insert(users)
    .values({
      username: `u${n}@teste.com`,
      email: `u${n}@teste.com`,
      // hash fixo; nenhum teste desta suíte faz login por HTTP
      password: "hash-de-teste",
      fullName: `Usuario ${n}`,
      cpf: String(10000000000 + n),
      phone: `1190000${String(n).padStart(4, "0")}`,
      pixKey: `u${n}@teste.com`,
      role: opcoes.role ?? "indicador",
      commissionValidated: opcoes.commissionValidated ?? null,
      commissionConverted: opcoes.commissionConverted ?? null,
      promoterId: opcoes.promoterId ?? null,
      teamSupervisorId: opcoes.teamSupervisorId ?? null,
      balance: opcoes.balance ?? "0.00",
      totalEarnings: "0.00",
      isActive: opcoes.isActive ?? true,
      mustChangePassword: false,
    })
    .returning();
  return usuario;
}

export async function criarIndicacao(params: {
  userId: number;
  companyId: number;
  promoterId?: number | null;
  status?: string;
}) {
  const n = proximo();
  const [indicacao] = await db
    .insert(referrals)
    .values({
      userId: params.userId,
      createdBy: params.userId,
      promoterId: params.promoterId ?? null,
      companyId: params.companyId,
      fullName: `Lead ${n}`,
      phone: `1198888${String(n).padStart(4, "0")}`,
      licensePlate: `TST${String(n).padStart(2, "0")}A1`,
      hasInsurance: false,
      status: (params.status ?? "pending") as any,
      city: "Sao Paulo",
      state: "SP",
    })
    .returning();
  return indicacao;
}

/** Saldo atual do usuário, como número. */
export async function saldoDe(userId: number): Promise<number> {
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
    columns: { balance: true },
  });
  return Number(u?.balance ?? 0);
}

/** Comissões gravadas na indicação, como números. */
export async function comissoesDe(referralId: number) {
  const r = await db.query.referrals.findFirst({
    where: (t, { eq }) => eq(t.id, referralId),
    columns: {
      commissionIndicator: true,
      commissionPromoter: true,
      commissionSupervisor: true,
      status: true,
    },
  });
  return {
    indicador: Number(r?.commissionIndicator ?? 0),
    promotor: Number(r?.commissionPromoter ?? 0),
    supervisor: Number(r?.commissionSupervisor ?? 0),
    status: r?.status,
  };
}
