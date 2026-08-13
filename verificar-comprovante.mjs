/**
 * A conversão com comprovante REAL passa — e paga.
 *
 *   node verificar-comprovante.mjs [url]
 *
 * Converter uma indicação exige anexar o comprovante de pagamento em base64.
 * O limite global de 256kb do express.json anulava o parser de 8mb da rota
 * (body-parser marca req._body e o segundo parser vira no-op), então qualquer
 * foto de verdade respondia 413 e a conversão — que paga os R$50 — não
 * acontecia. Um teste com payload pequeno não veria isso: o corpo cabia no
 * limite global e passava.
 *
 * Aqui o comprovante é grande de propósito (~700 KB), acima do limite antigo.
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
  await new Promise((r) => server.listen(5096, r));
  BASE = 'http://localhost:5096';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

console.log(`alvo: ${BASE}`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const NOME_LEAD = `Comprovante Teste ${marca}`;

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

// ~700 KB de base64: bem acima do limite global antigo (256kb), dentro do teto
// do schema (2,8 MB). É o tamanho de uma foto de comprovante comum.
const COMPROVANTE = 'data:image/png;base64,' + 'i'.repeat(700_000);

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou'); process.exit(1); }
const indicador = await entrar('joao@example.com', 'senha123');
if (!indicador.cookie) { console.log('indicador nao logou'); process.exit(1); }

const saldoAntes = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);

let idLead = null;

await checar('cria a indicacao', async () => {
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: {
      fullName: NOME_LEAD, phone: '119' + marca, licensePlates: ['CMP' + marca.slice(-4)],
      hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP',
    },
  });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const q = await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [NOME_LEAD]);
  idLead = q.rows[0]?.id;
  return !!idLead || 'nao achei a indicacao criada';
});

await checar('valida a indicacao (paga a comissao de validado)', async () => {
  const r = await req(`/api/referrals/${idLead}/status`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'validated' },
  });
  return r.status === 200 || `esperava 200, veio ${r.status}: ${(await r.text()).slice(0, 160)}`;
});

await checar('CONVERTE com comprovante de ~700 KB (antes: 413)', async () => {
  const r = await req(`/api/referrals/${idLead}/status`, {
    metodo: 'PATCH', cookie: admin.cookie,
    corpo: { status: 'converted', paymentProof: COMPROVANTE },
  });
  if (r.status === 413) return 'ainda responde 413 — o parser grande continua sem efeito';
  if (r.status !== 200) return `esperava 200, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
  return true;
});

await checar('o comprovante foi realmente gravado', async () => {
  const q = await pool.query('SELECT payment_proof, status FROM public.referrals WHERE id = $1', [idLead]);
  const l = q.rows[0];
  if (l.status !== 'converted') return `status ficou ${l.status}`;
  if (!l.payment_proof) return 'payment_proof vazio no banco';
  return l.payment_proof.length > 600_000 || `comprovante truncado (${l.payment_proof.length} chars)`;
});

await checar('a comissao de conversao caiu no saldo do indicador', async () => {
  const depois = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  const ganho = depois - saldoAntes;
  return ganho > 0 || `saldo nao subiu (antes ${saldoAntes}, depois ${depois})`;
});

await checar('payload ACIMA do teto do schema continua recusado', async () => {
  const gigante = 'data:image/png;base64,' + 'i'.repeat(3_000_000);
  const r = await req(`/api/referrals/${idLead}/status`, {
    metodo: 'PATCH', cookie: admin.cookie,
    corpo: { status: 'converted', paymentProof: gigante },
  });
  return r.status >= 400 || `aceitou comprovante de 3 MB (${r.status})`;
});

// limpeza: desfaz o crédito e remove o lead de teste
try {
  if (idLead) {
    await pool.query('DELETE FROM public.referral_conversations WHERE referral_id = $1', [idLead]);
    await pool.query('UPDATE public.sales_leads SET referral_id = NULL WHERE referral_id = $1', [idLead]);
    await pool.query('DELETE FROM public.cash_flow WHERE description ILIKE $1', [`%${NOME_LEAD}%`]);
    await pool.query('DELETE FROM public.referrals WHERE id = $1', [idLead]);
  }
  await pool.query('UPDATE public.users SET balance = $1, total_earnings = $1 WHERE id = 2', [saldoAntes.toFixed(2)]);
  console.log(`\nlimpeza: indicacao de teste removida e saldo do indicador restaurado (${saldoAntes.toFixed(2)})`);
} catch (e) {
  console.log(`\nlimpeza FALHOU: ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
