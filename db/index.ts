import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Decide se a conexão precisa de SSL.
 * - DATABASE_SSL=true|false força o comportamento
 * - caso contrário, liga SSL para hosts gerenciados (Supabase, Neon, RDS...)
 *   e desliga para Postgres local (Docker)
 */
function needsSsl(connectionString: string): boolean {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;

  try {
    const host = new URL(connectionString).hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "db" || // nome do serviço Postgres no docker-compose
      host === "postgres" ||
      host === "host.docker.internal";
    return !isLocal;
  } catch {
    return false;
  }
}

export function createPgPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    /**
     * Um pool de 10 conexões vira gargalo em pico: cada requisição que precisa
     * do banco fica na fila esperando uma conexão livre, e o tempo de resposta
     * cresce em cadeia mesmo com o Postgres ocioso.
     *
     * Ajuste conforme o limite do servidor de banco: o Postgres tem
     * `max_connections` (padrão 100) compartilhado entre TODAS as instâncias
     * da aplicação. Com 2 instâncias, 25 cada já é razoável.
     * No Supabase use o pooler (porta 6543) e mantenha este valor baixo.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 25),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Não deixa uma conexão presa para sempre se a rede cair no meio.
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 30_000),
  });
}

export const pool = createPgPool(process.env.DATABASE_URL);
export const db = drizzle(pool, { schema });
