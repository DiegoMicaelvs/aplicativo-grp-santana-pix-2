/**
 * Valida a função serverless localmente, no MESMO modo da Vercel:
 * VERCEL=1, NODE_ENV=production e o DATABASE_URL do Supabase.
 *
 * Sobe um servidor http mínimo que delega para o handler de api/index.ts —
 * é exatamente o que a Vercel faz. Se passar aqui, passa lá.
 *
 * Todas as requisições levam X-Forwarded-Proto: https porque na Vercel o TLS
 * termina no proxy. Sem isso o express-session não emite o cookie (secure:true)
 * e nenhuma sessão se sustenta.
 */
import { readFileSync } from 'fs';
import { createServer } from 'http';

const env = readFileSync('.env', 'utf8');
const linha = env
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l));

process.env.DATABASE_URL = linha.replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();
process.env.DATABASE_SSL = 'true';
process.env.DATABASE_POOL_MAX = '5';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.SESSION_SECRET = 'validacao-local-apenas-nao-e-a-de-producao';
process.env.MASTER_PASSWORD = 'validacao-local-apenas-nao-e-a-de-producao';
process.env.APP_TENANT = 'gruposantana';
process.env.TRUST_PROXY = '1';
process.env.LOGIN_MAX_PER_IP = '0';
process.env.REGISTER_MAX_PER_IP = '0';

// Importa o BUNDLE gerado (api/index.js), não o fonte: é exatamente o artefato
// que a Vercel executa. Rode `npm run build:vercel` antes.
const { default: handler } = await import('./api/index.js');

const server = createServer((req, res) => handler(req, res));
await new Promise((r) => server.listen(5099, r));

const BASE = 'http://localhost:5099';
let ok = 0, falhou = 0;

/** Toda requisição simula o proxy TLS da Vercel. */
function req(caminho, { cookie, metodo = 'GET', corpo } = {}) {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': '203.0.113.10',
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: 'manual',
  });
}

function pegarSid(r) {
  return (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('metis.sid='));
}

async function entrar(username, password) {
  const r = await req('/api/login', { metodo: 'POST', corpo: { username, password } });
  return { status: r.status, cookie: pegarSid(r) };
}

async function checar(nome, fn) {
  try {
    const r = await fn();
    const passou = r === true || r === undefined;
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${nome}${passou ? '' : `  (${r})`}`);
    passou ? ok++ : falhou++;
  } catch (e) {
    console.log(`FALHA ${nome} :: ${e.message}`);
    falhou++;
  }
}

let admin = null;

await checar('app monta em modo serverless (boot nao explode)', async () => {
  const r = await req('/api/user');
  return r.status === 401 || `esperava 401, veio ${r.status}`;
});

await checar('login do admin contra o Supabase', async () => {
  admin = await entrar('admin@gruposantana.com', 'admin123');
  return (admin.status === 200 && !!admin.cookie) || `status ${admin.status}, cookie ${admin.cookie}`;
});

await checar('sessao persiste (session store no Postgres)', async () => {
  const r = await req('/api/user', { cookie: admin.cookie });
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

await checar('listagem de indicacoes', async () => {
  const r = await req('/api/referrals', { cookie: admin.cookie });
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

await checar('painel de saques do financeiro', async () => {
  const r = await req('/api/admin/withdrawals', { cookie: admin.cookie });
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

await checar('hash de senha NAO vaza na resposta', async () => {
  const r = await req('/api/admin/users', { cookie: admin.cookie });
  const txt = await r.text();
  if (r.status !== 200) return `esperava 200, veio ${r.status}`;
  return !txt.includes('"password"') || 'campo password presente no JSON';
});

await checar('rota anonima nao cria admin (mass assignment)', async () => {
  const r = await req('/api/register-with-referral', {
    metodo: 'POST',
    corpo: { fullName: 'Invasor', phone: '11999990000', role: 'admin', balance: '99999' },
  });
  return r.status >= 400 || `rota anonima aceitou payload privilegiado (${r.status})`;
});

// Marca própria: tudo que o teste criar é apagado no fim, para não sujar a
// base da apresentação. Telefone/placa variam por execução — o sistema
// deduplica por ambos, então valores fixos fariam a 2a rodada falhar sozinha.
const MARCA = 'Validacao Serverless';
const unico = String(Date.now()).slice(-8);

await checar('criar indicacao (caminho de dinheiro) contra o Supabase', async () => {
  const ind = await entrar('joao@example.com', 'senha123');
  if (!ind.cookie) return `indicador nao logou (${ind.status})`;
  const r = await req('/api/referrals', {
    metodo: 'POST',
    cookie: ind.cookie,
    corpo: {
      fullName: MARCA,
      phone: '119' + unico,
      licensePlates: ['VRC' + unico.slice(-4)],
      hasInsurance: false,
      companyId: 1,
      city: 'Sao Paulo',
      state: 'SP',
    },
  });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
  return true;
});

await checar('link de indicacao /ref redireciona', async () => {
  const r = await req('/ref/qualquercoisa');
  return [301, 302, 303, 307, 308, 404].includes(r.status) || `status inesperado ${r.status}`;
});

// Limpeza: remove as indicações criadas por este teste (e por rodadas
// anteriores), para a base da apresentação não acumular registros falsos.
const { Pool } = (await import('pg')).default; // pg é CommonJS: named export só via .default
const limpeza = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const alvo = await limpeza.query('SELECT id FROM referrals WHERE full_name = $1', [MARCA]);
  const ids = alvo.rows.map((r) => r.id);
  if (ids.length) {
    // referral_plates tem ON DELETE CASCADE; as outras duas não, então vão antes.
    await limpeza.query('DELETE FROM referral_conversations WHERE referral_id = ANY($1::int[])', [ids]);
    await limpeza.query('UPDATE sales_leads SET referral_id = NULL WHERE referral_id = ANY($1::int[])', [ids]);
    await limpeza.query('DELETE FROM referrals WHERE id = ANY($1::int[])', [ids]);
  }
  console.log(`\nlimpeza: ${ids.length} indicacao(oes) de teste removida(s)`);
} catch (e) {
  console.log(`\nlimpeza FALHOU (remova a mao registros "${MARCA}"): ${e.message}`);
} finally {
  await limpeza.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server.close();
process.exit(falhou > 0 ? 1 : 0);
