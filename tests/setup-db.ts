import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

/**
 * Prepara um banco de teste ISOLADO.
 *
 * Os testes de dinheiro precisam de um Postgres de verdade — o que estamos
 * validando é justamente comportamento transacional (UPDATE condicional,
 * advisory lock, índice único). Um mock de banco não testaria nada disso.
 *
 * Usa uma base separada para nunca tocar nos dados de desenvolvimento, e é
 * criada pelo MESMO caminho documentado em docs/RODAR-LOCAL.md — então os
 * testes também verificam que o procedimento de setup funciona.
 */

const URL_ADMIN = process.env.TEST_ADMIN_DATABASE_URL
  ?? "postgresql://postgres:postgres@localhost:5433/postgres";

export const URL_TESTE = process.env.TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@localhost:5433/kongpix_test";

function nomeDoBanco(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

async function comCliente<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

function lerSql(arquivo: string): string {
  return readFileSync(resolve(process.cwd(), "db/migrations/manual", arquivo), "utf8");
}

export async function prepararBancoDeTeste(): Promise<void> {
  const banco = nomeDoBanco(URL_TESTE);

  // Recria do zero: teste que depende de sobra de execução anterior mente.
  await comCliente(URL_ADMIN, async (c) => {
    await c.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [banco],
    );
    await c.query(`DROP DATABASE IF EXISTS ${banco}`);
    await c.query(`CREATE DATABASE ${banco}`);
  });

  // 002 antes do push: sem a tabela, o drizzle-kit pergunta se `rate_limits`
  // é rename de `session` e trava. Mesma ordem do docs/RODAR-LOCAL.md.
  await comCliente(URL_TESTE, async (c) => {
    await c.query(lerSql("002-rate-limits.sql"));
  });

  const { execSync } = await import("child_process");
  execSync("npx drizzle-kit push --force --config=./drizzle.config.ts", {
    env: { ...process.env, DATABASE_URL: URL_TESTE },
    stdio: "pipe",
  });

  // 001 depois do push: é índice sobre expressão com WHERE parcial, que o
  // drizzle não conhece e removeria.
  await comCliente(URL_TESTE, async (c) => {
    await c.query(lerSql("001-placa-unica.sql"));
  });
}

/** Zera as tabelas entre testes, preservando a estrutura. */
export async function limparTabelas(cliente: pg.Pool): Promise<void> {
  await cliente.query(`
    TRUNCATE TABLE
      referral_plates, referral_conversations, referrals,
      withdrawal_requests, cash_flow, audit_log,
      ticket_responses, support_tickets, referral_links,
      rate_limits, company_settings, users, companies
    RESTART IDENTITY CASCADE
  `);
}
