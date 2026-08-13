/**
 * Testa a conexão com o Supabase SEM alterar o .env.
 * Lê a linha comentada da DATABASE_URL de produção e conecta uma vez.
 * Nunca imprime a senha.
 */
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env', 'utf8');

// Pega a linha do Supabase, comentada ou não
const linha = env
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l));

if (!linha) {
  console.error('Nao encontrei a DATABASE_URL do Supabase no .env');
  process.exit(1);
}

const url = linha.replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

// Diagnóstico da string sem revelar a senha
try {
  const u = new URL(url);
  const senha = decodeURIComponent(u.password ?? '');
  const precisaEncode = /[@#/:?&=+ ]/.test(senha);
  console.log('host   :', u.hostname);
  console.log('porta  :', u.port, u.port === '5432' ? '(session pooler, correto)' : '(ATENCAO: esperado 5432)');
  console.log('usuario:', u.username);
  console.log('senha  :', senha.length, 'caracteres');
  if (precisaEncode && senha === u.password) {
    console.log('AVISO  : a senha tem caractere especial e NAO parece codificada na URL');
  }
} catch (e) {
  console.error('URL malformada:', e.message);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const { rows } = await client.query(`
    SELECT
      current_database() AS banco,
      current_user       AS usuario,
      (SELECT count(*) FROM pg_tables WHERE schemaname='public')                AS tabelas,
      (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity) AS com_rls,
      (SELECT count(*) FROM public.users)                                        AS usuarios,
      (SELECT count(*) FROM public.referrals)                                    AS indicacoes
  `);
  console.log('\nCONEXAO OK');
  console.table(rows);
} catch (e) {
  console.error('\nFALHOU:', e.message);
  if (/password authentication failed/i.test(e.message)) {
    console.error('-> senha incorreta, ou tem caractere especial que precisa ser codificado na URL');
  }
  if (/ENOTFOUND|ETIMEDOUT/.test(e.message)) {
    console.error('-> host inacessivel: confira a regiao e se o projeto esta ativo');
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
