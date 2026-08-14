/**
 * TODAS as formas de cadastrar um indicador, com os dados que uma pessoa real
 * digita — máscara, espaço sobrando, DDI, maiúscula no e-mail.
 *
 *   node verificar-todas-formas-cadastro.mjs [url]
 *
 * Existe porque o Eduardo relatou "erro ao cadastrar indicador" e a mensagem na
 * tela não dizia o motivo. Nos logs o motivo estava lá: "Telefone inválido".
 * Este arquivo percorre os quatro caminhos de cadastro e vários formatos de
 * entrada, para que a próxima falha apareça aqui antes de aparecer para o
 * promotor.
 *
 * Tudo que é criado é removido no fim.
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
  await new Promise((r) => server.listen(5090, r));
  BASE = 'http://localhost:5090';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

async function limparRastro() {
  const alvo = await pool.query("SELECT id FROM public.users WHERE username LIKE '%@valida.teste'");
  const ids = alvo.rows.map((r) => r.id);
  if (!ids.length) return 0;
  const refs = await pool.query(
    'SELECT id FROM public.referrals WHERE user_id = ANY($1::int[]) OR created_by = ANY($1::int[]) OR promoter_id = ANY($1::int[])', [ids]);
  const rids = refs.rows.map((r) => r.id);
  if (rids.length) {
    await pool.query('DELETE FROM public.referral_conversations WHERE referral_id = ANY($1::int[])', [rids]);
    await pool.query('UPDATE public.sales_leads SET referral_id = NULL WHERE referral_id = ANY($1::int[])', [rids]);
    await pool.query("DELETE FROM public.audit_log WHERE entity_type='referral' AND entity_id = ANY($1::int[])", [rids]);
    await pool.query('DELETE FROM public.referrals WHERE id = ANY($1::int[])', [rids]);
  }
  const w = await pool.query('SELECT id FROM public.withdrawal_requests WHERE user_id = ANY($1::int[])', [ids]);
  const wids = w.rows.map((r) => r.id);
  if (wids.length) {
    await pool.query('DELETE FROM public.cash_flow WHERE related_withdrawal_id = ANY($1::int[])', [wids]);
    await pool.query('DELETE FROM public.withdrawal_requests WHERE id = ANY($1::int[])', [wids]);
  }
  await pool.query('DELETE FROM public.referral_links WHERE promoter_id = ANY($1::int[])', [ids]);
  await pool.query('DELETE FROM public.audit_log WHERE user_id = ANY($1::int[]) OR entity_id = ANY($1::int[])', [ids]);
  const d = await pool.query('DELETE FROM public.users WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  return d.rowCount ?? 0;
}
await limparRastro();

console.log(`alvo: ${BASE}\n`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-6);
let serie = 0;

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
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${nome}${passou ? '' : `\n        ${r}`}`);
    passou ? ok++ : falhou++;
  } catch (e) { console.log(`ERRO  ${nome} :: ${e.message}`); falhou++; }
}

function cpfValido(s) {
  const base = String(100000000 + (s * 7919) % 800000000).slice(0, 9).split('').map(Number);
  const d = (n) => { const p = n.length + 1; const t = n.reduce((a, x, i) => a + x * (p - i), 0); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = d(base); const d2 = d([...base, d1]);
  return base.join('') + d1 + d2;
}
/** CPF com máscara, como sai do formulário. */
const comMascara = (cpf) => `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

function dadosBase(rotulo, extra = {}) {
  serie++;
  const u = `${rotulo}.${serie}.${marca}@valida.teste`;
  return {
    fullName: `Teste ${rotulo} ${serie}`,
    username: u, email: u, password: 'senha123456',
    cpf: comMascara(cpfValido(serie)),
    phone: '(11) 97000-' + String(1000 + serie).slice(-4),
    address: 'Rua Teste, 1', city: 'Sao Paulo', state: 'SP', zipCode: '01001-000',
    shirtSize: 'M', pixKey: u,
    ...extra,
  };
}

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou'); process.exit(1); }

// Promotor dono dos cadastros
const PROM = `prom.formas.${marca}@valida.teste`;
await req('/api/admin/users', {
  metodo: 'POST', cookie: admin.cookie,
  corpo: { ...dadosBase('promotor'), username: PROM, email: PROM, pixKey: PROM, role: 'promotor' },
});
const idProm = (await pool.query('SELECT id FROM public.users WHERE username = $1', [PROM])).rows[0]?.id;
if (!idProm) { console.log('nao consegui criar o promotor base'); process.exit(1); }
const prom = await entrar(PROM, 'senha123456');

console.log('--- os quatro caminhos de cadastro ---');

await checar('1. admin cadastra pelo painel de perfis', async () => {
  const d = dadosBase('viaadmin', { role: 'indicador' });
  const r = await req('/api/admin/users', { metodo: 'POST', cookie: admin.cookie, corpo: d });
  return r.status === 201 || `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
});

await checar('2. promotor cadastra pela tela "Cadastrar Indicador"', async () => {
  const d = dadosBase('viapromotor');
  const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const u = (await pool.query('SELECT promoter_id FROM public.users WHERE username = $1', [d.username])).rows[0];
  return u.promoter_id === idProm || `não vinculou ao promotor (${u.promoter_id})`;
});

let slug = null;
await checar('3. cadastro pelo LINK do promotor', async () => {
  const rl = await req('/api/referral-links', {
    metodo: 'POST', cookie: prom.cookie, corpo: { name: `Campanha ${marca}` },
  });
  if (rl.status !== 201 && rl.status !== 200) return `criar link: ${rl.status}`;
  slug = (await pool.query('SELECT slug FROM public.referral_links WHERE promoter_id = $1 ORDER BY id DESC LIMIT 1', [idProm])).rows[0]?.slug;
  if (!slug) return 'link não gravado';

  const d = dadosBase('vialink');
  const r = await req('/api/register-with-referral', {
    metodo: 'POST', corpo: { referralToken: slug, userData: d },
  });
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const u = (await pool.query('SELECT promoter_id FROM public.users WHERE username = $1', [d.username])).rows[0];
  return u.promoter_id === idProm || `não vinculou ao dono do link (${u.promoter_id})`;
});

await checar('4. cadastro público direto (/api/register)', async () => {
  const d = dadosBase('viapublico');
  const r = await req('/api/register', { metodo: 'POST', corpo: d });
  return [200, 201].includes(r.status) || `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
});

console.log('\n--- formatos que a pessoa digita de verdade ---');

const formatosTelefone = [
  ['celular com máscara',        '(11) 97000-3001'],
  ['celular só dígitos',         '11970003002'],
  ['celular com espaço e traço', '11 97000-3003'],
  ['fixo de 10 dígitos',         '(11) 3000-3004'],
  ['com DDI +55',                '+55 (11) 97000-3005'],
  ['com DDI sem mais',           '5511970003006'],
  ['com espaços sobrando',       '  (11) 97000-3007  '],
];

for (const [rotulo, telefone] of formatosTelefone) {
  await checar(`telefone ${rotulo}: "${telefone}"`, async () => {
    const d = dadosBase('tel', { phone: telefone });
    const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
    if (r.status !== 201) return `recusado com ${r.status}: ${(await r.text()).slice(0, 160)}`;
    const u = (await pool.query('SELECT phone FROM public.users WHERE username = $1', [d.username])).rows[0];
    return /^\d{10,11}$/.test(u.phone) || `gravado como "${u.phone}" (deveria ser só dígitos)`;
  });
}

const formatosCpf = [
  ['com máscara',      (n) => comMascara(cpfValido(n))],
  ['só dígitos',       (n) => cpfValido(n)],
  ['com espaços',      (n) => ' ' + comMascara(cpfValido(n)) + ' '],
];

for (const [rotulo, gerar] of formatosCpf) {
  await checar(`CPF ${rotulo}`, async () => {
    const d = dadosBase('cpf');
    d.cpf = gerar(serie + 500);
    const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
    if (r.status !== 201) return `recusado com ${r.status}: ${(await r.text()).slice(0, 160)}`;
    const u = (await pool.query('SELECT cpf FROM public.users WHERE username = $1', [d.username])).rows[0];
    return /^\d{11}$/.test(u.cpf) || `gravado como "${u.cpf}"`;
  });
}

await checar('e-mail com MAIÚSCULAS entra e permite login', async () => {
  const d = dadosBase('maiuscula');
  d.username = d.username.toUpperCase();
  d.email = d.email.toUpperCase();
  const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const s = await entrar(d.username.toLowerCase(), 'senha123456');
  return s.status === 200 || `login com o e-mail em minúscula falhou (${s.status})`;
});

console.log('\n--- quando o dado está errado, a mensagem diz o motivo ---');

await checar('telefone curto: recusa com 400 e explica', async () => {
  const d = dadosBase('telruim', { phone: '97000' });
  const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r.status === 500) return 'ainda responde 500 genérico — o motivo não chega na tela';
  if (r.status !== 400) return `esperava 400, veio ${r.status}`;
  const t = await r.text();
  return /telefone/i.test(t) || `400 mas sem citar o telefone: ${t.slice(0, 140)}`;
});

await checar('CPF inválido: recusa com 400 e explica', async () => {
  const d = dadosBase('cpfruim', { cpf: '111.111.111-11' });
  const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r.status === 500) return 'ainda responde 500 genérico';
  if (r.status !== 400) return `esperava 400, veio ${r.status}`;
  const t = await r.text();
  return /cpf/i.test(t) || `400 mas sem citar o CPF: ${t.slice(0, 140)}`;
});

await checar('e-mail repetido: recusa com 409 e explica', async () => {
  const d = dadosBase('repetido');
  const r1 = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r1.status !== 201) return `primeiro cadastro falhou: ${r1.status}`;
  const d2 = { ...dadosBase('repetido2'), username: d.username, email: d.email };
  const r2 = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d2 });
  if (r2.status === 500) return 'ainda responde 500 genérico';
  if (r2.status !== 409) return `esperava 409, veio ${r2.status}`;
  const t = await r2.text();
  return /cadastrad/i.test(t) || `409 mas sem explicar: ${t.slice(0, 140)}`;
});

await checar('CPF repetido: recusa com 409 e explica', async () => {
  const d = dadosBase('cpfrep');
  const r1 = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d });
  if (r1.status !== 201) return `primeiro cadastro falhou: ${r1.status}`;
  const d2 = dadosBase('cpfrep2');
  d2.cpf = d.cpf;
  const r2 = await req('/api/promoter/indicators', { metodo: 'POST', cookie: prom.cookie, corpo: d2 });
  if (r2.status === 500) return 'ainda responde 500 genérico';
  if (r2.status !== 409) return `esperava 409, veio ${r2.status}`;
  return /cadastrad/i.test(await r2.text()) || '409 sem explicar';
});

try {
  const n = await limparRastro();
  console.log(`\nlimpeza: ${n} usuário(s) de teste`);
} catch (e) {
  console.log(`\nlimpeza FALHOU: ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
