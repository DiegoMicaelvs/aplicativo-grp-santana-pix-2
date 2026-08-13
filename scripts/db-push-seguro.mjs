/**
 * Empurra o schema para o banco e REAPLICA os índices manuais em seguida.
 *
 *   npm run db:push            (pede confirmação se o alvo não for local)
 *   npm run db:push -- --sim   (não pergunta; para uso em script)
 *
 * Por que existe: `drizzle-kit push --force` remove do banco tudo que não
 * reconhece — e o índice único parcial de placa
 * (db/migrations/manual/001-placa-unica.sql) é exatamente disso: unique sobre
 * EXPRESSÃO com WHERE parcial, que o Drizzle não expressa. Ou seja, cada
 * `db:push` derrubava silenciosamente a única proteção que impede pagar
 * comissão duas vezes pelo mesmo carro, e a reaplicação dependia de alguém
 * lembrar de rodar o .sql à mão.
 *
 * Aqui as duas coisas viram um passo só, e apontar para um banco remoto exige
 * confirmação explícita — este comando altera estrutura, e já aconteceu de um
 * script de manutenção rodar no banco errado.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { createInterface } from 'readline';

const PASTA_MANUAL = 'db/migrations/manual';

function urlDoAmbiente() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync('.env', 'utf8');
    const linha = env.split(/\r?\n/).map((l) => l.trim())
      .find((l) => /^DATABASE_URL=/.test(l));
    return linha ? linha.replace(/^DATABASE_URL=/, '').trim() : '';
  } catch {
    return '';
  }
}

const url = urlDoAmbiente();
if (!url) {
  console.error('DATABASE_URL não definido (nem no ambiente, nem no .env).');
  process.exit(1);
}

const host = (() => {
  try { return new URL(url).hostname; } catch { return '(host ilegível)'; }
})();
const ehLocal = /^(localhost|127\.0\.0\.1|db|postgres|host\.docker\.internal)$/.test(host);

console.log(`banco alvo: ${host}${ehLocal ? '  (local)' : '  ← REMOTO'}`);

if (!ehLocal && !process.argv.includes('--sim')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await new Promise((r) =>
    rl.question(`\nIsto vai ALTERAR A ESTRUTURA de um banco remoto (${host}).\nDigite "sim" para continuar: `, (x) => { rl.close(); r(x); }),
  );
  if (resposta.trim().toLowerCase() !== 'sim') {
    console.log('cancelado — nada foi alterado.');
    process.exit(1);
  }
}

console.log('\n1/2  drizzle-kit push');
const push = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['drizzle-kit', 'push', '--force', '--config=./drizzle.config.ts'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
);
if (push.status !== 0) {
  console.error('\ndrizzle-kit push falhou — índices manuais NÃO foram reaplicados.');
  process.exit(push.status ?? 1);
}

console.log('\n2/2  reaplicando índices manuais');
const { Pool } = (await import('pg')).default;
const pool = new Pool({
  connectionString: url,
  ssl: /supabase|amazonaws|render|neon/.test(host) ? { rejectUnauthorized: false } : undefined,
});

try {
  const arquivos = readdirSync(PASTA_MANUAL).filter((f) => f.endsWith('.sql')).sort();
  for (const arquivo of arquivos) {
    const sql = readFileSync(join(PASTA_MANUAL, arquivo), 'utf8');
    try {
      await pool.query(sql);
      console.log(`  OK   ${arquivo}`);
    } catch (e) {
      // Um índice que não aplica por dado duplicado precisa ser visto, não engolido.
      console.error(`  FALHA ${arquivo}: ${e.message}`);
      process.exitCode = 1;
    }
  }

  const idx = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'referrals_placa_ativa_uniq'",
  );
  console.log(
    idx.rows.length
      ? '\nproteção de placa duplicada: ativa'
      : '\nATENÇÃO: o índice referrals_placa_ativa_uniq NÃO está no banco — a mesma placa pode ser paga duas vezes.',
  );
  if (!idx.rows.length) process.exitCode = 1;
} finally {
  await pool.end();
}
