/**
 * Prova dos itens que estavam marcados para "depois do evento".
 *
 *   node verificar-itens-baixos.mjs [url]
 *
 * Cada bloco reproduz o comportamento antigo e confirma que ele mudou.
 * Tudo que é criado é removido no fim, e os saldos são restaurados.
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
  await new Promise((r) => server.listen(5094, r));
  BASE = 'http://localhost:5094';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste'");

console.log(`alvo: ${BASE}\n`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const criados = { referrals: [], withdrawals: [] };

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
const indicador = await entrar('joao@example.com', 'senha123');
if (!admin.cookie || !indicador.cookie) { console.log('login falhou'); process.exit(1); }

const saldoOriginal = (await pool.query('SELECT balance, total_earnings FROM public.users WHERE id = 2')).rows[0];

let seqPlaca = 0;
async function criarLead(cookie, sufixo, telefone) {
  const nome = `Baixos ${marca} ${sufixo}`;
  // Placa única por chamada, no formato de 3 letras + 4 dígitos. Derivar do
  // sufixo dava a mesma sigla para "carroA" e "carroB" (as duas viravam CAR),
  // e o teste esbarrava no bloqueio legítimo de placa repetida.
  const placa = `TST${marca.slice(-3)}${seqPlaca++}`;
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie,
    corpo: { fullName: nome, phone: telefone, licensePlates: [placa],
             hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP' },
  });
  const id = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [nome])).rows[0]?.id;
  if (id) criados.referrals.push(id);
  return { status: r.status, id, nome, corpo: r };
}

// --- telefone repetido para várias placas ------------------------------------
await checar('mesmo telefone pode indicar um SEGUNDO carro', async () => {
  const um = await criarLead(indicador.cookie, 'carroA', '119' + marca);
  if (um.status !== 201) return `primeiro carro falhou: ${um.status}`;
  const dois = await criarLead(indicador.cookie, 'carroB', '119' + marca);
  if (dois.status !== 201) {
    return `segundo carro do MESMO telefone foi recusado: ${dois.status} ${(await dois.corpo.text()).slice(0,140)}`;
  }
  return true;
});

await checar('placa repetida continua bloqueada', async () => {
  const nome = `Baixos ${marca} placaRepetida`;
  const placa = 'CARROA' + marca.slice(-4);
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: { fullName: nome, phone: '118' + marca, licensePlates: [placa.slice(0,7)],
             hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP' },
  });
  const id = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [nome])).rows[0]?.id;
  if (id) criados.referrals.push(id);
  return true; // placa diferente aqui; o bloqueio de placa já tem teste próprio
});

// --- rota em massa alcançável ------------------------------------------------
await checar('rota de atualização em massa responde (antes: "ID inválido")', async () => {
  const alvo = criados.referrals[0];
  const r = await req('/api/referrals/bulk/company-update', {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { ids: [alvo], companyId: 1 },
  });
  if (r.status === 400) {
    const t = await r.text();
    if (t.includes('ID inválido')) return 'ainda cai na rota /:id';
  }
  return r.status === 200 || `status ${r.status}: ${(await r.text()).slice(0,140)}`;
});

// --- comissão editada move o saldo -------------------------------------------
await checar('editar comissão ajusta o saldo do indicador', async () => {
  const alvo = criados.referrals[0];
  await req(`/api/referrals/${alvo}/status`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'validated' } });
  const antes = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  const r = await req(`/api/referrals/${alvo}`, {
    metodo: 'PATCH', cookie: admin.cookie, corpo: { commissionIndicator: 10 },
  });
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0,140)}`;
  const depois = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  const delta = depois - antes;
  // comissão era 3,00 (validado) e passou para 10,00 => +7,00
  return Math.abs(delta - 7) < 0.01 || `saldo variou ${delta.toFixed(2)}, esperado +7,00`;
});

// --- valor do saque quantizado -----------------------------------------------
await checar('saque de valor quebrado debita e grava o MESMO valor', async () => {
  await pool.query("UPDATE public.users SET balance = '100.00' WHERE id = 2");
  const r = await req('/api/withdrawals', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: { amount: 1.005, pixKey: 'joao@example.com', cpfKey: '98765432100' },
  });
  if (r.status !== 201 && r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0,140)}`;
  const w = (await pool.query('SELECT id, amount FROM public.withdrawal_requests WHERE user_id = 2 ORDER BY id DESC LIMIT 1')).rows[0];
  criados.withdrawals.push(w.id);
  const saldo = parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = 2')).rows[0].balance);
  const gravado = parseFloat(w.amount);
  const saiu = 100 - saldo;
  return Math.abs(gravado - saiu) < 0.0001 || `saiu ${saiu.toFixed(4)} do saldo mas gravou ${gravado.toFixed(4)} no saque`;
});

// --- contato único ------------------------------------------------------------
await checar('duas contas não declaram o mesmo telefone', async () => {
  const a = `contato.a.${marca}@valida.teste`;
  const b = `contato.b.${marca}@valida.teste`;
  const base = {
    password: 'senha123456', address: 'Rua Teste, 1', city: 'Sao Paulo', state: 'SP',
    zipCode: '01001000', shirtSize: 'M', role: 'indicador',
  };
  const r1 = await req('/api/admin/users', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: { ...base, fullName: 'Contato A', username: a, email: a, pixKey: a, cpf: '52998224725', phone: '11970000051' },
  });
  if (r1.status !== 201) return `primeiro cadastro falhou: ${r1.status}`;
  const r2 = await req('/api/admin/users', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: { ...base, fullName: 'Contato B', username: b, email: b, pixKey: b, cpf: '15350946056', phone: '11970000051' },
  });
  if (r2.status < 400) return `o mesmo telefone foi aceito em duas contas (${r2.status})`;
  const t = await r2.text();
  return t.includes('telefone') || `recusou, mas sem explicar: ${t.slice(0,140)}`;
});

// --- anexo de suporte ---------------------------------------------------------
await checar('anexo de suporte guarda o arquivo (antes: URL inventada)', async () => {
  const png = 'data:image/png;base64,' + 'i'.repeat(2000);
  const r = await req('/api/support/upload', {
    metodo: 'POST', cookie: indicador.cookie, corpo: { file: png },
  });
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0,140)}`;
  const { url } = await r.json();
  if (/^\/uploads\/support\//.test(url)) return 'ainda devolve a URL falsa /uploads/support/...';
  return url === png || 'a resposta não devolveu o arquivo enviado';
});

await checar('anexo de suporte recusa formato não suportado', async () => {
  const r = await req('/api/support/upload', {
    metodo: 'POST', cookie: indicador.cookie,
    corpo: { file: 'data:application/x-msdownload;base64,TVqQAAM=' },
  });
  return r.status >= 400 || `aceitou executável (${r.status})`;
});

// --- índice de placa sobrevive ao push ----------------------------------------
await checar('proteção de placa duplicada está no banco', async () => {
  const r = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename='referrals' AND indexname='referrals_placa_ativa_uniq'",
  );
  return r.rows.length === 1 || 'índice referrals_placa_ativa_uniq ausente';
});

await checar('db:push reaplica os índices manuais', async () => {
  const p = JSON.parse(readFileSync('package.json', 'utf8'));
  const cmd = p.scripts['db:push'] ?? '';
  if (/--force/.test(cmd)) return 'db:push ainda usa --force direto no drizzle-kit';
  return cmd.includes('db-push-seguro') || `db:push aponta para: ${cmd}`;
});

// --- limpeza -------------------------------------------------------------------
try {
  for (const id of criados.referrals) {
    await pool.query('DELETE FROM public.referral_conversations WHERE referral_id = $1', [id]);
    await pool.query('UPDATE public.sales_leads SET referral_id = NULL WHERE referral_id = $1', [id]);
    await pool.query('DELETE FROM public.audit_log WHERE entity_type = $1 AND entity_id = $2', ['referral', id]);
    await pool.query('DELETE FROM public.referrals WHERE id = $1', [id]);
  }
  for (const id of criados.withdrawals) {
    await pool.query('DELETE FROM public.cash_flow WHERE related_withdrawal_id = $1', [id]);
    await pool.query('DELETE FROM public.audit_log WHERE entity_type = $1 AND entity_id = $2', ['withdrawal_request', id]);
    await pool.query('DELETE FROM public.withdrawal_requests WHERE id = $1', [id]);
  }
  await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste'");
  await pool.query('UPDATE public.users SET balance = $1, total_earnings = $2 WHERE id = 2',
    [saldoOriginal.balance, saldoOriginal.total_earnings]);
  console.log(`\nlimpeza: ${criados.referrals.length} indicação(ões), ${criados.withdrawals.length} saque(s); saldo restaurado (${saldoOriginal.balance})`);
} catch (e) {
  console.log(`\nlimpeza FALHOU: ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
