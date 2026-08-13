/**
 * Cadastro pelo LINK do promotor — o caminho que o indicador usa sozinho.
 *
 *   node verificar-cadastro-por-link.mjs [url]
 *
 * Este fluxo esteve quebrado em produção: o usuário era criado dentro de uma
 * transação e a auditoria era gravada FORA dela, então o INSERT em audit_log
 * referenciava um user_id que o banco ainda não enxergava, batia na chave
 * estrangeira e revertia tudo. A rota respondia 500 e quem clicava no link
 * preenchia o cadastro para nada — os links tinham cliques e zero cadastros.
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
  await new Promise((r) => server.listen(5091, r));
  BASE = 'http://localhost:5091';
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
  // Os links apontam para o promotor: precisam sair antes dele.
  await pool.query('DELETE FROM public.referral_links WHERE promoter_id = ANY($1::int[])', [ids]);
  await pool.query('DELETE FROM public.audit_log WHERE user_id = ANY($1::int[]) OR entity_id = ANY($1::int[])', [ids]);
  const d = await pool.query('DELETE FROM public.users WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  return d.rowCount ?? 0;
}
await limparRastro();

console.log(`alvo: ${BASE}\n`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-6);
let linkCriado = null;

function req(caminho, { cookie, metodo = 'GET', corpo } = {}) {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      'X-Forwarded-Proto': 'https',
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: 'manual',
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

function cpfValido(serie) {
  const base = String(100000000 + (serie * 7919) % 800000000).slice(0, 9).split('').map(Number);
  const digito = (n) => { const p = n.length + 1; const s = n.reduce((a, x, i) => a + x * (p - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = digito(base); const d2 = digito([...base, d1]);
  return base.join('') + d1 + d2;
}

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou'); process.exit(1); }

// Promotor dono do link
const PROM = `prom.link.${marca}@valida.teste`;
await req('/api/admin/users', {
  metodo: 'POST', cookie: admin.cookie,
  corpo: {
    fullName: 'Promotor do Link', username: PROM, email: PROM, password: 'senha123456',
    cpf: cpfValido(1), phone: '11970009001', address: 'Rua Teste', city: 'Sao Paulo',
    state: 'SP', zipCode: '01001000', shirtSize: 'M', pixKey: PROM, role: 'promotor',
  },
});
const idProm = (await pool.query('SELECT id FROM public.users WHERE username = $1', [PROM])).rows[0].id;
const prom = await entrar(PROM, 'senha123456');

await checar('promotor cria o link de indicação', async () => {
  const r = await req('/api/referral-links', {
    metodo: 'POST', cookie: prom.cookie, corpo: { name: `Campanha ${marca}` },
  });
  if (r.status !== 201 && r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const l = (await pool.query('SELECT slug FROM public.referral_links WHERE promoter_id = $1 ORDER BY id DESC LIMIT 1', [idProm])).rows[0];
  linkCriado = l?.slug;
  return !!linkCriado || 'link não foi gravado';
});

await checar('o link redireciona para o cadastro', async () => {
  const r = await req(`/ref/${linkCriado}`);
  if (![301, 302, 307, 308].includes(r.status)) return `esperava redirecionamento, veio ${r.status}`;
  const destino = r.headers.get('location') ?? '';
  return destino.includes(linkCriado) || `redirecionou para ${destino}`;
});

const NOVO = `indicador.link.${marca}@valida.teste`;

await checar('REPRODUZ O BUG: cadastro pelo link conclui (antes: 500)', async () => {
  const r = await req('/api/register-with-referral', {
    metodo: 'POST',
    corpo: {
      referralToken: linkCriado,
      userData: {
        fullName: 'Indicador Via Link', username: NOVO, email: NOVO, password: 'senha123456',
        cpf: cpfValido(2), phone: '11970009002', address: 'Rua Teste',
        city: 'Sao Paulo', state: 'SP', zipCode: '01001000', shirtSize: 'M', pixKey: NOVO,
      },
    },
  });
  if (r.status === 500) return `ainda responde 500: ${(await r.text()).slice(0, 200)}`;
  return r.status === 201 || `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
});

await checar('o novo indicador fica vinculado ao dono do link', async () => {
  const u = (await pool.query('SELECT role, promoter_id FROM public.users WHERE username = $1', [NOVO])).rows[0];
  if (!u) return 'usuário não foi criado';
  if (u.role !== 'indicador') return `papel gravado: ${u.role}`;
  return u.promoter_id === idProm || `promoter_id ${u.promoter_id}, esperado ${idProm}`;
});

await checar('a auditoria do cadastro foi gravada junto', async () => {
  const id = (await pool.query('SELECT id FROM public.users WHERE username = $1', [NOVO])).rows[0].id;
  const a = await pool.query(
    "SELECT action FROM public.audit_log WHERE user_id = $1 AND action = 'register_with_referral'", [id]);
  return a.rows.length === 1 || `esperava 1 registro de auditoria, achei ${a.rows.length}`;
});

await checar('o contador de cadastros do link subiu', async () => {
  const l = (await pool.query('SELECT signup_count FROM public.referral_links WHERE slug = $1', [linkCriado])).rows[0];
  return l.signup_count === 1 || `contador ficou em ${l.signup_count}`;
});

await checar('o novo indicador consegue entrar', async () => {
  const s = await entrar(NOVO, 'senha123456');
  return (s.status === 200 && !!s.cookie) || `login falhou: ${s.status}`;
});

await checar('token inexistente não cria vínculo indevido', async () => {
  const outro = `semlink.${marca}@valida.teste`;
  const r = await req('/api/register-with-referral', {
    metodo: 'POST',
    corpo: {
      referralToken: 'token-que-nao-existe',
      userData: {
        fullName: 'Sem Link', username: outro, email: outro, password: 'senha123456',
        cpf: cpfValido(3), phone: '11970009003', address: 'Rua Teste',
        city: 'Sao Paulo', state: 'SP', zipCode: '01001000', shirtSize: 'M', pixKey: outro,
      },
    },
  });
  if (r.status >= 400) return true; // recusar também é aceitável
  const u = (await pool.query('SELECT promoter_id FROM public.users WHERE username = $1', [outro])).rows[0];
  return !u || u.promoter_id === null || `ficou vinculado ao promotor ${u.promoter_id} sem link válido`;
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
