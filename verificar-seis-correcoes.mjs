/**
 * Prova das seis correções abertas no relatório de auditoria.
 *
 *   node verificar-seis-correcoes.mjs [url]
 *
 * Cada bloco reproduz o problema original e confirma que ele não acontece mais.
 * Tudo que é criado é removido no fim, e o saldo do indicador é restaurado.
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
  await new Promise((r) => server.listen(5095, r));
  BASE = 'http://localhost:5095';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

console.log(`alvo: ${BASE}\n`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const LEAD = `Seis Correcoes ${marca}`;
const criados = { referrals: [], users: [], withdrawals: [] };

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
const indicador = await entrar('joao@example.com', 'senha123');

const saldoOriginal = (await pool.query('SELECT balance, total_earnings FROM public.users WHERE id = 2')).rows[0];

// ---------------------------------------------------------------------------
console.log('[1 e 2] saque: máquina de estados e transação');
// ---------------------------------------------------------------------------

// Dá saldo ao indicador para ele poder pedir saque
await pool.query("UPDATE public.users SET balance = '100.00' WHERE id = 2");

const pedido = await req('/api/withdrawals', {
  metodo: 'POST', cookie: indicador.cookie,
  corpo: { amount: 50, pixKey: 'joao@example.com', cpfKey: '98765432100' },
});
const idSaque = (await pool.query(
  "SELECT id FROM public.withdrawal_requests WHERE user_id = 2 ORDER BY id DESC LIMIT 1"
)).rows[0]?.id;
if (idSaque) criados.withdrawals.push(idSaque);

await checar('pedido de saque criado e valor saiu do saldo', async () => {
  if (pedido.status !== 201 && pedido.status !== 200) return `status ${pedido.status}: ${(await pedido.text()).slice(0,160)}`;
  const b = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  return Math.abs(b - 50) < 0.01 || `saldo esperado 50.00, veio ${b}`;
});

await checar('rejeitar devolve o valor ao saldo', async () => {
  const r = await req(`/api/admin/withdrawals/${idSaque}`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'rejected', notes: 'teste' },
  });
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0,160)}`;
  const b = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  return Math.abs(b - 100) < 0.01 || `saldo esperado 100.00, veio ${b}`;
});

await checar('REPRODUZ O BUG: rejeitado -> aprovado é recusado (antes criava dinheiro)', async () => {
  const r = await req(`/api/admin/withdrawals/${idSaque}`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'approved' },
  });
  if (r.status !== 409) return `esperava 409, veio ${r.status}`;
  const b = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  return Math.abs(b - 100) < 0.01 || `saldo mudou indevidamente: ${b}`;
});

await checar('ciclo repetido não infla o saldo', async () => {
  for (let i = 0; i < 5; i++) {
    await req(`/api/admin/withdrawals/${idSaque}`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'approved' } });
    await req(`/api/admin/withdrawals/${idSaque}`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'rejected' } });
  }
  const b = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  return Math.abs(b - 100) < 0.01 || `saldo inflou para ${b} (deveria continuar 100.00)`;
});

// ---------------------------------------------------------------------------
console.log('\n[3] analista não valida a própria indicação');
// ---------------------------------------------------------------------------

await checar('admin não valida indicação que ele mesmo cadastrou', async () => {
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: { fullName: LEAD + ' propria', phone: '119' + marca, licensePlates: ['SEG' + marca.slice(-4)],
             hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP' },
  });
  if (r.status !== 201) return `nao criou a indicacao: ${r.status}`;
  const id = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [LEAD + ' propria'])).rows[0].id;
  criados.referrals.push(id);
  const v = await req(`/api/referrals/${id}/status`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'validated' },
  });
  if (v.status !== 403) return `esperava 403, veio ${v.status}`;
  const st = (await pool.query('SELECT status FROM public.referrals WHERE id = $1', [id])).rows[0].status;
  return st === 'pending' || `status mudou para ${st} mesmo com 403`;
});

await checar('validação por OUTRA pessoa continua funcionando', async () => {
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: { fullName: LEAD + ' terceiro', phone: '118' + marca, licensePlates: ['TER' + marca.slice(-4)],
             hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP' },
  });
  if (r.status !== 201) return `nao criou: ${r.status}`;
  const id = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [LEAD + ' terceiro'])).rows[0].id;
  criados.referrals.push(id);
  const v = await req(`/api/referrals/${id}/status`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'validated' },
  });
  return v.status === 200 || `esperava 200, veio ${v.status}: ${(await v.text()).slice(0,160)}`;
});

// ---------------------------------------------------------------------------
console.log('\n[4] painel público da empresa');
// ---------------------------------------------------------------------------

const empresa = (await pool.query('SELECT id, public_token FROM public.companies ORDER BY id LIMIT 1')).rows[0];

await checar('acesso por ID sequencial é recusado', async () => {
  const r = await req(`/api/public/company-metrics/${empresa.id}`);
  return r.status === 404 || `esperava 404, veio ${r.status}`;
});

await checar('acesso por token funciona', async () => {
  if (!empresa.public_token) return 'empresa sem token — rode scripts/generate-company-tokens.ts';
  const r = await req(`/api/public/company-metrics/${empresa.public_token}`);
  return r.status === 200 || `esperava 200, veio ${r.status}`;
});

await checar('a resposta NÃO devolve o publicToken', async () => {
  const r = await req(`/api/public/company-metrics/${empresa.public_token}`);
  const txt = await r.text();
  if (txt.includes(empresa.public_token)) return 'o token aparece na resposta';
  return !txt.includes('publicToken') || 'campo publicToken presente';
});

// ---------------------------------------------------------------------------
console.log('\n[5] comprovante fora da listagem');
// ---------------------------------------------------------------------------

const COMPROVANTE = 'data:image/png;base64,' + 'i'.repeat(400_000);
let idComProva = null;

await checar('prepara indicação convertida com comprovante', async () => {
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: { fullName: LEAD + ' prova', phone: '117' + marca, licensePlates: ['PRV' + marca.slice(-4)],
             hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP' },
  });
  if (r.status !== 201) return `nao criou: ${r.status}`;
  idComProva = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [LEAD + ' prova'])).rows[0].id;
  criados.referrals.push(idComProva);
  await req(`/api/referrals/${idComProva}/status`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'validated' } });
  const c = await req(`/api/referrals/${idComProva}/status`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'converted', paymentProof: COMPROVANTE },
  });
  return c.status === 200 || `conversao falhou: ${c.status}`;
});

await checar('listagem não carrega a imagem, só sinaliza que existe', async () => {
  const r = await req('/api/admin/referrals', { cookie: admin.cookie });
  if (r.status !== 200) return `status ${r.status}`;
  const txt = await r.text();
  if (txt.includes('data:image/png;base64,iii')) return `a imagem veio na listagem (${(txt.length/1024).toFixed(0)} KB)`;
  const lista = JSON.parse(txt);
  const alvo = (Array.isArray(lista) ? lista : lista.data ?? []).find((x) => x.id === idComProva);
  if (!alvo) return 'indicacao nao encontrada na listagem';
  return alvo.hasPaymentProof === true || `hasPaymentProof veio ${alvo.hasPaymentProof}`;
});

await checar('rota dedicada entrega o comprovante inteiro', async () => {
  const r = await req(`/api/referrals/${idComProva}/payment-proof`, { cookie: admin.cookie });
  if (r.status !== 200) return `status ${r.status}`;
  const { paymentProof } = await r.json();
  return (paymentProof && paymentProof.length > 300_000) || `comprovante veio com ${paymentProof?.length ?? 0} chars`;
});

await checar('comprovante não vaza para quem não pode ver a indicação', async () => {
  const outro = `curioso.${marca}@valida.teste`;
  const c = await req('/api/admin/users', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: { fullName: 'Curioso', username: outro, email: outro, password: 'senha123456',
             cpf: '52998224725', phone: '11970000041', address: 'a', city: 'b', state: 'SP',
             zipCode: '01001000', shirtSize: 'M', pixKey: outro, role: 'indicador' },
  });
  if (c.status !== 201) return `nao criei o usuario de teste: ${c.status}`;
  criados.users.push(outro);
  const s = await entrar(outro, 'senha123456');
  const r = await req(`/api/referrals/${idComProva}/payment-proof`, { cookie: s.cookie });
  return r.status === 403 || `esperava 403, veio ${r.status}`;
});

// ---------------------------------------------------------------------------
console.log('\n[6] log e auditoria sem dado pessoal');
// ---------------------------------------------------------------------------

await checar('audit_log não guarda comprovante nem dado pessoal do lead', async () => {
  await req(`/api/referrals/${idComProva}`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { notes: 'edicao de teste' },
  });
  const r = await pool.query(
    "SELECT old_values, new_values FROM public.audit_log WHERE entity_type='referral' AND entity_id=$1 ORDER BY id DESC LIMIT 1",
    [idComProva],
  );
  if (!r.rows.length) return true; // nenhuma entrada gerada: nada a vazar
  const bruto = JSON.stringify(r.rows[0]);
  if (bruto.includes('data:image')) return 'comprovante gravado no audit_log';
  if (bruto.includes('117' + marca)) return 'telefone do lead gravado no audit_log';
  return true;
});

await checar('exclusão de usuário não arquiva CPF, PIX nem senha', async () => {
  const alvo = criados.users[0];
  if (!alvo) return true;
  const id = (await pool.query('SELECT id FROM public.users WHERE username = $1', [alvo])).rows[0]?.id;
  if (!id) return true;
  await req(`/api/admin/users/${id}/delete`, {
    metodo: 'DELETE', cookie: admin.cookie,
    corpo: { masterPassword: process.env.MASTER_PASSWORD ?? 'verificacao-local' },
  });
  const r = await pool.query(
    "SELECT old_values FROM public.audit_log WHERE entity_type='user' AND entity_id=$1 ORDER BY id DESC LIMIT 1",
    [id],
  );
  if (!r.rows.length) return true;
  const bruto = JSON.stringify(r.rows[0].old_values ?? {});
  for (const campo of ['password', 'cpf', 'pixKey', 'balance']) {
    if (bruto.includes(`"${campo}"`)) return `audit_log guardou ${campo}`;
  }
  return true;
});

// ---------------------------------------------------------------------------
try {
  for (const id of criados.referrals) {
    await pool.query('DELETE FROM public.referral_conversations WHERE referral_id = $1', [id]);
    await pool.query('UPDATE public.sales_leads SET referral_id = NULL WHERE referral_id = $1', [id]);
    await pool.query('DELETE FROM public.audit_log WHERE entity_type = $1 AND entity_id = $2', ['referral', id]);
    await pool.query('DELETE FROM public.referrals WHERE id = $1', [id]);
  }
  for (const id of criados.withdrawals) {
    await pool.query('DELETE FROM public.cash_flow WHERE related_withdrawal_id = $1', [id]);
    await pool.query('DELETE FROM public.withdrawal_requests WHERE id = $1', [id]);
  }
  await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste'");
  await pool.query('UPDATE public.users SET balance = $1, total_earnings = $2 WHERE id = 2',
    [saldoOriginal.balance, saldoOriginal.total_earnings]);
  console.log(`\nlimpeza: ${criados.referrals.length} indicação(ões), ${criados.withdrawals.length} saque(s), usuários de teste; saldo restaurado (${saldoOriginal.balance})`);
} catch (e) {
  console.log(`\nlimpeza FALHOU: ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
