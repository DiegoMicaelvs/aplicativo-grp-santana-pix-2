/**
 * O gerente enxerga exatamente o que as permissões dele permitem — nem mais,
 * nem menos.
 *
 *   node verificar-permissoes-gerente.mjs [url]
 *
 * Cria dois gerentes: um com um conjunto PARCIAL de permissões e outro com
 * NENHUMA. O interessante não é o que o primeiro consegue abrir, e sim o que
 * ambos continuam sem conseguir — inclusive escrever, que segue restrito ao
 * admin. Também confere que um indicador comum não alcança nada disso.
 *
 * Tudo que cria é removido no fim.
 */
import { readFileSync } from 'fs';
import { createServer } from 'http';

const alvoExterno = process.argv[2];

const env = readFileSync('.env', 'utf8');
const DB = env.split(/\r?\n/).map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l))
  .replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

let server = null;
let BASE = alvoExterno?.replace(/\/$/, '');

if (!alvoExterno) {
  Object.assign(process.env, {
    DATABASE_URL: DB, DATABASE_SSL: 'true', DATABASE_POOL_MAX: '5',
    NODE_ENV: 'production', VERCEL: '1',
    SESSION_SECRET: 'verificacao-local', MASTER_PASSWORD: 'verificacao-local',
    APP_TENANT: 'gruposantana', TRUST_PROXY: '1',
    LOGIN_MAX_PER_IP: '0', REGISTER_MAX_PER_IP: '0',
  });
  const { default: handler } = await import('./api/index.js');
  server = createServer((req, res) => handler(req, res));
  await new Promise((r) => server.listen(5097, r));
  BASE = 'http://localhost:5097';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const sobras = await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id");
if (sobras.rowCount) console.log(`(limpeza inicial: ${sobras.rowCount})`);

console.log(`alvo: ${BASE}\n`);

let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const PARCIAL = `gerente.parcial.${marca}@valida.teste`;
const SEMPERM = `gerente.semperm.${marca}@valida.teste`;
const INDICADOR = `indicador.comum.${marca}@valida.teste`;

function req(caminho, { cookie, metodo = 'GET', corpo } = {}) {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      'X-Forwarded-Proto': 'https',
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
}
const sid = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('metis.sid='));
async function entrar(u, p) {
  const r = await req('/api/login', { metodo: 'POST', corpo: { username: u, password: p } });
  return { status: r.status, cookie: sid(r) };
}
async function checar(nome, fn) {
  try {
    const r = await fn();
    const passou = r === true || r === undefined;
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${nome}${passou ? '' : `  -> ${r}`}`);
    passou ? ok++ : falhou++;
  } catch (e) { console.log(`ERRO  ${nome} :: ${e.message}`); falhou++; }
}

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou'); process.exit(1); }

async function criar(username, role, permissions, cpf, phone) {
  const r = await req('/api/admin/users', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: {
      fullName: `Teste ${role}`, username, email: username, password: 'senha123456',
      cpf, phone, address: 'Rua Teste, 1', city: 'Sao Paulo', state: 'SP',
      zipCode: '01001000', shirtSize: 'M', pixKey: username, role,
      ...(permissions ? { permissions } : {}),
    },
  });
  if (r.status !== 201) throw new Error(`criar ${role}: ${r.status} ${(await r.text()).slice(0, 160)}`);
}

// Só leitura de indicações e auditoria. Sem financeiro, sem usuários.
await criar(PARCIAL, 'gerente', ['view_all_referrals', 'audit_access'], '52998224725', '11970000031');
await criar(SEMPERM, 'gerente', [], '15350946056', '11970000032');
await criar(INDICADOR, 'indicador', null, '11144477735', '11970000033');

const gParcial = await entrar(PARCIAL, 'senha123456');
const gSem = await entrar(SEMPERM, 'senha123456');
const ind = await entrar(INDICADOR, 'senha123456');

const status = async (caminho, cookie) => (await req(caminho, { cookie })).status;

await checar('gerente COM view_all_referrals le as indicacoes', async () => {
  const s = await status('/api/admin/referrals', gParcial.cookie);
  return s === 200 || `esperava 200, veio ${s}`;
});

await checar('gerente COM audit_access le a auditoria', async () => {
  const s = await status('/api/admin/audit-log', gParcial.cookie);
  return s === 200 || `esperava 200, veio ${s}`;
});

await checar('gerente SEM permissao financeira NAO ve saques', async () => {
  const s = await status('/api/admin/withdrawals', gParcial.cookie);
  return s === 403 || `esperava 403, veio ${s}`;
});

await checar('gerente SEM view_all_users NAO lista usuarios', async () => {
  const s = await status('/api/admin/users', gParcial.cookie);
  return s === 403 || `esperava 403, veio ${s}`;
});

await checar('gerente sem NENHUMA permissao nao abre nada', async () => {
  const rotas = ['/api/admin/referrals', '/api/admin/users', '/api/admin/withdrawals', '/api/admin/audit-log', '/api/admin/promoters'];
  const abertas = [];
  for (const rota of rotas) {
    if ((await status(rota, gSem.cookie)) === 200) abertas.push(rota);
  }
  return abertas.length === 0 || `abriu: ${abertas.join(', ')}`;
});

await checar('gerente NAO cria usuario (escrita segue so do admin)', async () => {
  const novo = `tentativa.${marca}@valida.teste`;
  const r = await req('/api/admin/users', {
    metodo: 'POST', cookie: gParcial.cookie,
    corpo: { fullName: 'X', username: novo, email: novo, password: 'senha123456',
             cpf: '12345678909', phone: '11970000034', address: 'a', city: 'b',
             state: 'SP', zipCode: '01001000', shirtSize: 'M', pixKey: novo, role: 'admin' },
  });
  if (r.status !== 403) return `esperava 403, veio ${r.status}`;
  const q = await pool.query('SELECT id FROM public.users WHERE username = $1', [novo]);
  return q.rows.length === 0 || 'usuario foi criado mesmo com 403';
});

await checar('gerente nao consegue se dar mais permissoes', async () => {
  const idG = (await pool.query('SELECT id FROM public.users WHERE username = $1', [PARCIAL])).rows[0].id;
  await req(`/api/admin/users/${idG}/permissions`, {
    metodo: 'POST', cookie: gParcial.cookie,
    corpo: { userId: idG, permissions: ['manage_withdrawals', 'manage_all_users'] },
  });
  const perms = (await pool.query('SELECT permissions FROM public.users WHERE id = $1', [idG])).rows[0].permissions ?? [];
  const ganhou = ['manage_withdrawals', 'manage_all_users'].filter((p) => perms.includes(p));
  return ganhou.length === 0 || `escalou permissoes: ${ganhou.join(', ')}`;
});

await checar('indicador comum continua sem acesso administrativo', async () => {
  const rotas = ['/api/admin/referrals', '/api/admin/users', '/api/admin/withdrawals', '/api/admin/audit-log', '/api/admin/stats'];
  const abertas = [];
  for (const rota of rotas) {
    if ((await status(rota, ind.cookie)) === 200) abertas.push(rota);
  }
  return abertas.length === 0 || `indicador abriu: ${abertas.join(', ')}`;
});

await checar('admin continua acessando tudo', async () => {
  const rotas = ['/api/admin/referrals', '/api/admin/users', '/api/admin/withdrawals', '/api/admin/audit-log', '/api/admin/promoters', '/api/admin/stats'];
  const fechadas = [];
  for (const rota of rotas) {
    const s = await status(rota, admin.cookie);
    if (s !== 200) fechadas.push(`${rota} (${s})`);
  }
  return fechadas.length === 0 || `admin perdeu acesso a: ${fechadas.join(', ')}`;
});

try {
  const r = await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id");
  console.log(`\nlimpeza: ${r.rowCount} usuario(s) de teste removido(s)`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
