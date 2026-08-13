/**
 * Valida o Valida já publicado, batendo na URL pública de produção.
 *
 *   node validar-producao.mjs [url]
 *
 * Diferente de validar-serverless.mjs (que roda o bundle localmente), este
 * exercita o deploy real: CDN, função serverless, Supabase e sessão.
 * Tudo que criar é removido no fim, para não sujar a base da apresentação.
 */
import { readFileSync } from 'fs';

const BASE = (process.argv[2] || 'https://valida-six.vercel.app').replace(/\/$/, '');
let ok = 0, falhou = 0;

function req(caminho, { cookie, metodo = 'GET', corpo } = {}) {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: 'manual',
  });
}

const pegarSid = (r) =>
  (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('metis.sid='));

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

console.log(`alvo: ${BASE}\n`);

let admin = null;
const MARCA = 'Validacao Producao';
const unico = String(Date.now()).slice(-8);

await checar('landing carrega pelo CDN', async () => {
  const r = await req('/');
  if (r.status !== 200) return `status ${r.status}`;
  const html = await r.text();
  return /valida/i.test(html) || 'HTML nao parece ser o app Valida';
});

await checar('assets do client servidos', async () => {
  const html = await (await req('/')).text();
  const m = html.match(/\/assets\/[A-Za-z0-9._-]+\.js/);
  if (!m) return 'nenhum bundle /assets/*.js referenciado no HTML';
  const r = await req(m[0]);
  return r.status === 200 || `asset ${m[0]} -> ${r.status}`;
});

await checar('funcao serverless viva (401 JSON, nao 500)', async () => {
  const r = await req('/api/user');
  if (r.status !== 401) return `esperava 401, veio ${r.status}`;
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') || `content-type ${ct} (proxy/erro no meio?)`;
});

await checar('deploy publico (sem tela de login da Vercel)', async () => {
  const r = await req('/');
  const html = await r.text();
  return !/vercel.*(authentication|sso)/i.test(html) || 'ainda protegido pela Vercel';
});

await checar('login do admin contra o Supabase', async () => {
  admin = await entrar('admin@gruposantana.com', 'admin123');
  return (admin.status === 200 && !!admin.cookie) || `status ${admin.status}, cookie ${admin.cookie}`;
});

await checar('sessao persiste entre invocacoes da funcao', async () => {
  const r = await req('/api/user', { cookie: admin.cookie });
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

await checar('cookie de sessao seguro (Secure + HttpOnly)', async () => {
  const r = await req('/api/login', {
    metodo: 'POST',
    corpo: { username: 'admin@gruposantana.com', password: 'admin123' },
  });
  const bruto = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('metis.sid=')) || '';
  if (!/HttpOnly/i.test(bruto)) return 'sem HttpOnly';
  if (!/Secure/i.test(bruto)) return 'sem Secure';
  return true;
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

await checar('criar indicacao (caminho de dinheiro) em producao', async () => {
  const ind = await entrar('joao@example.com', 'senha123');
  if (!ind.cookie) return `indicador nao logou (${ind.status})`;
  const r = await req('/api/referrals', {
    metodo: 'POST',
    cookie: ind.cookie,
    corpo: {
      fullName: MARCA,
      phone: '119' + unico,
      licensePlates: ['PRD' + unico.slice(-4)],
      hasInsurance: false,
      companyId: 1,
      city: 'Sao Paulo',
      state: 'SP',
    },
  });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
  return true;
});

await checar('rota do SPA cai no index (nao 404)', async () => {
  const r = await req('/auth');
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

// Limpeza direta no Supabase — a API não expõe remoção de indicação.
const env = readFileSync('.env', 'utf8');
const DB = env.split(/\r?\n/).map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l))
  ?.replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

if (DB) {
  const { Pool } = (await import('pg')).default;
  const limpeza = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  try {
    const alvo = await limpeza.query('SELECT id FROM referrals WHERE full_name = $1', [MARCA]);
    const ids = alvo.rows.map((r) => r.id);
    if (ids.length) {
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
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
process.exit(falhou > 0 ? 1 : 0);
