/**
 * Caminho completo do dinheiro, com os valores que o PROMOTOR configurou.
 *
 *   node verificar-rateio-e-saque.mjs [url]
 *
 * Percorre: promotor cadastra indicador com comissão própria -> indicador
 * cadastra o lead -> analista valida -> analista converte -> indicador saca.
 * A cada passo confere o saldo de CADA pessoa da hierarquia, e não só o total.
 *
 * Os valores usados são de propósito diferentes do padrão (R$3 / R$50): se o
 * sistema ignorasse a configuração do promotor e caísse no padrão, as contas
 * não bateriam e o teste falharia.
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
  await new Promise((r) => server.listen(5093, r));
  BASE = 'http://localhost:5093';
}

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

/**
 * Remove tudo que pertence aos usuários de teste, na ordem das dependências.
 *
 * Apagar os usuários primeiro falha com violação de chave estrangeira: as
 * indicações da execução anterior ainda apontam para eles. Serve tanto para a
 * limpeza inicial quanto para a final.
 */
async function limparRastro() {
  const alvo = await pool.query("SELECT id FROM public.users WHERE username LIKE '%@valida.teste'");
  const ids = alvo.rows.map((r) => r.id);
  if (!ids.length) return 0;

  const refs = await pool.query(
    'SELECT id FROM public.referrals WHERE user_id = ANY($1::int[]) OR created_by = ANY($1::int[]) OR promoter_id = ANY($1::int[])',
    [ids],
  );
  const rids = refs.rows.map((r) => r.id);
  if (rids.length) {
    await pool.query('DELETE FROM public.referral_conversations WHERE referral_id = ANY($1::int[])', [rids]);
    await pool.query('UPDATE public.sales_leads SET referral_id = NULL WHERE referral_id = ANY($1::int[])', [rids]);
    await pool.query("DELETE FROM public.audit_log WHERE entity_type='referral' AND entity_id = ANY($1::int[])", [rids]);
    await pool.query('DELETE FROM public.referrals WHERE id = ANY($1::int[])', [rids]);
  }

  const saques = await pool.query('SELECT id FROM public.withdrawal_requests WHERE user_id = ANY($1::int[])', [ids]);
  const wids = saques.rows.map((r) => r.id);
  if (wids.length) {
    await pool.query('DELETE FROM public.cash_flow WHERE related_withdrawal_id = ANY($1::int[])', [wids]);
    await pool.query("DELETE FROM public.audit_log WHERE entity_type='withdrawal_request' AND entity_id = ANY($1::int[])", [wids]);
    await pool.query('DELETE FROM public.withdrawal_requests WHERE id = ANY($1::int[])', [wids]);
  }

  await pool.query('DELETE FROM public.audit_log WHERE user_id = ANY($1::int[])', [ids]);
  const del = await pool.query('DELETE FROM public.users WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  return del.rowCount ?? 0;
}

const sobras = await limparRastro();
if (sobras) console.log(`(limpeza inicial: ${sobras} usuário(s) de execução anterior)`);

console.log(`alvo: ${BASE}\n`);
let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const criados = { referrals: [], withdrawals: [] };
let seq = 0;

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

const saldo = async (id) =>
  parseFloat((await pool.query('SELECT balance FROM public.users WHERE id = $1', [id])).rows[0].balance);
const idDe = async (username) =>
  (await pool.query('SELECT id FROM public.users WHERE username = $1', [username])).rows[0]?.id;

/**
 * CPF válido a partir de um número de série.
 *
 * Uma lista fixa de CPFs acabava assim que o teste ganhava mais um personagem
 * — o índice passava do fim do array e virava `undefined`, e o erro que
 * aparecia era "CPF inválido", sem relação com o que se queria testar.
 */
function cpfValido(serie) {
  const base = String(100000000 + (serie * 7919) % 800000000).slice(0, 9).split('').map(Number);
  const digito = (nums) => {
    const peso = nums.length + 1;
    const soma = nums.reduce((s, n, i) => s + n * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = digito(base);
  const d2 = digito([...base, d1]);
  return base.join('') + d1 + d2;
}

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou'); process.exit(1); }

async function criarUsuario({ username, role, cookie, extra = {} }) {
  const rota = role === 'promotor' ? '/api/admin/users' : null;
  const corpo = {
    fullName: `Rateio ${role} ${marca}`,
    username, email: username, password: 'senha123456',
    cpf: cpfValido(seq), phone: '1197000' + String(1000 + seq).slice(-4),
    address: 'Rua Teste, 1', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
    shirtSize: 'M', pixKey: username, role, ...extra,
  };
  seq++;
  const r = await req(rota ?? '/api/admin/users', { metodo: 'POST', cookie: cookie ?? admin.cookie, corpo });
  if (r.status !== 201) throw new Error(`criar ${role}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return await idDe(username);
}

async function criarLead(cookie, etiqueta) {
  const nome = `Lead ${etiqueta} ${marca}`;
  const r = await req('/api/referrals', {
    metodo: 'POST', cookie,
    corpo: {
      fullName: nome, phone: '1198' + String(100000 + seq++).slice(-6),
      licensePlates: [`RAT${marca.slice(-3)}${seq}`],
      hasInsurance: false, companyId: 1, city: 'Sao Paulo', state: 'SP',
    },
  });
  if (r.status !== 201) throw new Error(`criar lead: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const id = (await pool.query('SELECT id FROM public.referrals WHERE full_name = $1', [nome])).rows[0].id;
  criados.referrals.push(id);
  return id;
}

const mudarStatus = (id, status, cookie) =>
  req(`/api/referrals/${id}/status`, {
    metodo: 'PATCH', cookie,
    corpo: status === 'converted'
      ? { status, paymentProof: 'data:image/png;base64,' + 'i'.repeat(500) }
      : { status },
  });

// ===========================================================================
console.log('CENARIO A — promotor -> indicador (sem supervisor)');
console.log('  promotor define: R$2,50 no validado e R$40,00 no convertido');
console.log('  esperado: do pool de R$4 o promotor fica com R$1,50;');
console.log('            do bonus de R$60 o promotor fica com R$20,00\n');
// ===========================================================================

const PROM_A = `prom.a.${marca}@valida.teste`;
const IND_A = `ind.a.${marca}@valida.teste`;

const idPromA = await criarUsuario({ username: PROM_A, role: 'promotor' });
const promA = await entrar(PROM_A, 'senha123456');

await checar('promotor cadastra indicador com comissão própria', async () => {
  const r = await req('/api/promoter/indicators', {
    metodo: 'POST', cookie: promA.cookie,
    corpo: {
      fullName: 'Indicador A', username: IND_A, email: IND_A, password: 'senha123456',
      cpf: cpfValido(seq), phone: '1197000' + String(1000 + seq).slice(-4),
      address: 'Rua Teste, 2', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
      shirtSize: 'M', pixKey: IND_A,
      commissionValidated: 2.5, commissionConverted: 40,
    },
  });
  seq++;
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const u = (await pool.query('SELECT commission_validated, commission_converted, promoter_id FROM public.users WHERE username = $1', [IND_A])).rows[0];
  if (parseFloat(u.commission_validated) !== 2.5) return `comissão de validado gravada: ${u.commission_validated}`;
  if (parseFloat(u.commission_converted) !== 40) return `comissão de convertido gravada: ${u.commission_converted}`;
  if (u.promoter_id !== idPromA) return `indicador não ficou vinculado ao promotor`;
  return true;
});

const idIndA = await idDe(IND_A);
const indA = await entrar(IND_A, 'senha123456');

const leadA = await criarLead(indA.cookie, 'A');

await checar('VALIDADO: indicador recebe R$2,50 e promotor R$1,50', async () => {
  const antesInd = await saldo(idIndA), antesProm = await saldo(idPromA);
  const r = await mudarStatus(leadA, 'validated', admin.cookie);
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const ganhoInd = (await saldo(idIndA)) - antesInd;
  const ganhoProm = (await saldo(idPromA)) - antesProm;
  const erros = [];
  if (Math.abs(ganhoInd - 2.5) > 0.001) erros.push(`indicador ganhou ${ganhoInd.toFixed(2)}, esperado 2,50`);
  if (Math.abs(ganhoProm - 1.5) > 0.001) erros.push(`promotor ganhou ${ganhoProm.toFixed(2)}, esperado 1,50`);
  if (Math.abs(ganhoInd + ganhoProm - 4) > 0.001) erros.push(`soma ${(ganhoInd + ganhoProm).toFixed(2)} != pool 4,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('CONVERTIDO: indicador +R$40,00 e promotor +R$20,00', async () => {
  const antesInd = await saldo(idIndA), antesProm = await saldo(idPromA);
  const r = await mudarStatus(leadA, 'converted', admin.cookie);
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const ganhoInd = (await saldo(idIndA)) - antesInd;
  const ganhoProm = (await saldo(idPromA)) - antesProm;
  const erros = [];
  if (Math.abs(ganhoInd - 40) > 0.001) erros.push(`indicador ganhou ${ganhoInd.toFixed(2)}, esperado 40,00`);
  if (Math.abs(ganhoProm - 20) > 0.001) erros.push(`promotor ganhou ${ganhoProm.toFixed(2)}, esperado 20,00`);
  if (Math.abs(ganhoInd + ganhoProm - 60) > 0.001) erros.push(`soma ${(ganhoInd + ganhoProm).toFixed(2)} != bônus 60,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('totais após conversão: R$42,50 e R$21,50 (soma = R$64,00)', async () => {
  const sInd = await saldo(idIndA), sProm = await saldo(idPromA);
  const erros = [];
  if (Math.abs(sInd - 42.5) > 0.001) erros.push(`indicador tem ${sInd.toFixed(2)}, esperado 42,50`);
  if (Math.abs(sProm - 21.5) > 0.001) erros.push(`promotor tem ${sProm.toFixed(2)}, esperado 21,50`);
  if (Math.abs(sInd + sProm - 64) > 0.001) erros.push(`soma ${(sInd + sProm).toFixed(2)} != 64,00 (pool 4 + bônus 60)`);
  return erros.length === 0 || erros.join(' | ');
});

// ===========================================================================
console.log('\nCENARIO B — promotor -> supervisor -> indicador');
console.log('  promotor aloca ao supervisor: R$3,00 validado / R$55,00 convertido');
console.log('  supervisor repassa ao indicador: R$2,00 validado / R$45,00 convertido');
console.log('  esperado no validado: indicador 2,00 | supervisor 1,00 | promotor 1,00');
console.log('  esperado no bonus:    indicador 45,00 | supervisor 10,00 | promotor 5,00\n');
// ===========================================================================

const PROM_B = `prom.b.${marca}@valida.teste`;
const SUP_B = `sup.b.${marca}@valida.teste`;
const IND_B = `ind.b.${marca}@valida.teste`;

const idPromB = await criarUsuario({ username: PROM_B, role: 'promotor' });
const promB = await entrar(PROM_B, 'senha123456');

await checar('promotor cadastra supervisor com alocação definida', async () => {
  const r = await req('/api/promoter/supervisors', {
    metodo: 'POST', cookie: promB.cookie,
    corpo: {
      fullName: 'Supervisor B', username: SUP_B, email: SUP_B, password: 'senha123456',
      cpf: cpfValido(seq), phone: '1197000' + String(1000 + seq).slice(-4),
      address: 'Rua Teste, 3', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
      shirtSize: 'M', pixKey: SUP_B,
      commissionValidated: 3, commissionConverted: 55,
    },
  });
  seq++;
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const u = (await pool.query('SELECT commission_validated, commission_converted, promoter_id FROM public.users WHERE username = $1', [SUP_B])).rows[0];
  if (parseFloat(u.commission_validated) !== 3) return `alocação de validado: ${u.commission_validated}`;
  if (u.promoter_id !== idPromB) return 'supervisor não ficou vinculado ao promotor';
  return true;
});

const idSupB = await idDe(SUP_B);

await checar('promotor cadastra indicador sob esse supervisor', async () => {
  const r = await req('/api/promoter/indicators', {
    metodo: 'POST', cookie: promB.cookie,
    corpo: {
      fullName: 'Indicador B', username: IND_B, email: IND_B, password: 'senha123456',
      cpf: cpfValido(seq), phone: '1197000' + String(1000 + seq).slice(-4),
      address: 'Rua Teste, 4', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
      shirtSize: 'M', pixKey: IND_B,
      commissionValidated: 2, commissionConverted: 45,
      teamSupervisorId: String(idSupB),
    },
  });
  seq++;
  if (r.status !== 201) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const u = (await pool.query('SELECT team_supervisor_id FROM public.users WHERE username = $1', [IND_B])).rows[0];
  return u.team_supervisor_id === idSupB || `vínculo com supervisor não gravado (${u.team_supervisor_id})`;
});

const idIndB = await idDe(IND_B);
const indB = await entrar(IND_B, 'senha123456');
const leadB = await criarLead(indB.cookie, 'B');

await checar('VALIDADO em três níveis: 2,00 | 1,00 | 1,00', async () => {
  const a = [await saldo(idIndB), await saldo(idSupB), await saldo(idPromB)];
  const r = await mudarStatus(leadB, 'validated', admin.cookie);
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const d = [(await saldo(idIndB)) - a[0], (await saldo(idSupB)) - a[1], (await saldo(idPromB)) - a[2]];
  const esperado = [2, 1, 1];
  const nomes = ['indicador', 'supervisor', 'promotor'];
  const erros = d.map((v, i) => Math.abs(v - esperado[i]) > 0.001 ? `${nomes[i]} ganhou ${v.toFixed(2)}, esperado ${esperado[i].toFixed(2)}` : null).filter(Boolean);
  const soma = d.reduce((s, v) => s + v, 0);
  if (Math.abs(soma - 4) > 0.001) erros.push(`soma ${soma.toFixed(2)} != pool 4,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('CONVERTIDO em três níveis: 45,00 | 10,00 | 5,00', async () => {
  const a = [await saldo(idIndB), await saldo(idSupB), await saldo(idPromB)];
  const r = await mudarStatus(leadB, 'converted', admin.cookie);
  if (r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 160)}`;
  const d = [(await saldo(idIndB)) - a[0], (await saldo(idSupB)) - a[1], (await saldo(idPromB)) - a[2]];
  const esperado = [45, 10, 5];
  const nomes = ['indicador', 'supervisor', 'promotor'];
  const erros = d.map((v, i) => Math.abs(v - esperado[i]) > 0.001 ? `${nomes[i]} ganhou ${v.toFixed(2)}, esperado ${esperado[i].toFixed(2)}` : null).filter(Boolean);
  const soma = d.reduce((s, v) => s + v, 0);
  if (Math.abs(soma - 60) > 0.001) erros.push(`soma ${soma.toFixed(2)} != bônus 60,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('nada foi criado do nada: total pago = R$64,00 por indicação', async () => {
  const t = (await saldo(idIndB)) + (await saldo(idSupB)) + (await saldo(idPromB));
  return Math.abs(t - 64) > 0.001 ? `hierarquia acumulou ${t.toFixed(2)}, esperado 64,00` : true;
});

// ===========================================================================
console.log('\nSAQUE');
// ===========================================================================

await checar('saque com a chave do próprio cadastro fica PENDENTE', async () => {
  const antes = await saldo(idIndA);
  const r = await req('/api/withdrawals', {
    metodo: 'POST', cookie: indA.cookie,
    corpo: { amount: 20, pixKey: IND_A, cpfKey: (await pool.query('SELECT cpf FROM public.users WHERE id=$1', [idIndA])).rows[0].cpf },
  });
  if (r.status !== 201 && r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const w = (await pool.query('SELECT id, status, amount FROM public.withdrawal_requests WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [idIndA])).rows[0];
  criados.withdrawals.push(w.id);
  const depois = await saldo(idIndA);
  const erros = [];
  if (w.status !== 'pending') erros.push(`status ficou "${w.status}", esperado "pending"`);
  if (Math.abs((antes - depois) - 20) > 0.001) erros.push(`saiu ${(antes - depois).toFixed(2)} do saldo, esperado 20,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('saque para chave de TERCEIRO fica RETIDO', async () => {
  const r = await req('/api/withdrawals', {
    metodo: 'POST', cookie: indA.cookie,
    corpo: { amount: 5, pixKey: 'chave.de.outra.pessoa@exemplo.com', cpfKey: (await pool.query('SELECT cpf FROM public.users WHERE id=$1', [idIndA])).rows[0].cpf },
  });
  if (r.status !== 201 && r.status !== 200) return `status ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const w = (await pool.query('SELECT id, status, notes FROM public.withdrawal_requests WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [idIndA])).rows[0];
  criados.withdrawals.push(w.id);
  return w.status === 'retido' || `status ficou "${w.status}", esperado "retido"`;
});

await checar('saque acima do saldo é recusado', async () => {
  const atual = await saldo(idIndA);
  const r = await req('/api/withdrawals', {
    metodo: 'POST', cookie: indA.cookie,
    corpo: { amount: atual + 1000, pixKey: IND_A, cpfKey: (await pool.query('SELECT cpf FROM public.users WHERE id=$1', [idIndA])).rows[0].cpf },
  });
  if (r.status < 400) return `aceitou saque acima do saldo (${r.status})`;
  const depois = await saldo(idIndA);
  return Math.abs(depois - atual) < 0.001 || `o saldo mudou mesmo com a recusa`;
});

await checar('financeiro paga o saque e o valor não volta ao saldo', async () => {
  const idSaque = criados.withdrawals[0];
  const antes = await saldo(idIndA);
  const ap = await req(`/api/admin/withdrawals/${idSaque}`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'approved' } });
  if (ap.status !== 200) return `aprovar: ${ap.status}`;
  const pg = await req(`/api/admin/withdrawals/${idSaque}`, { metodo: 'PATCH', cookie: admin.cookie, corpo: { status: 'paid' } });
  if (pg.status !== 200) return `pagar: ${pg.status}`;
  const depois = await saldo(idIndA);
  const w = (await pool.query('SELECT status FROM public.withdrawal_requests WHERE id=$1', [idSaque])).rows[0];
  const erros = [];
  if (w.status !== 'paid') erros.push(`status ficou "${w.status}"`);
  if (Math.abs(depois - antes) > 0.001) erros.push(`o saldo mudou ao pagar (${antes.toFixed(2)} -> ${depois.toFixed(2)}); o valor já tinha saído no pedido`);
  const ganhos = parseFloat((await pool.query('SELECT total_earnings FROM public.users WHERE id=$1', [idIndA])).rows[0].total_earnings);
  if (Math.abs(ganhos - 20) > 0.001) erros.push(`total sacado ficou ${ganhos.toFixed(2)}, esperado 20,00`);
  return erros.length === 0 || erros.join(' | ');
});

await checar('caixa registrou a saída do pagamento', async () => {
  const idSaque = criados.withdrawals[0];
  const c = await pool.query('SELECT type, amount FROM public.cash_flow WHERE related_withdrawal_id = $1', [idSaque]);
  if (c.rows.length !== 1) return `esperava 1 lançamento, achei ${c.rows.length}`;
  const l = c.rows[0];
  return (l.type === 'outflow' && Math.abs(parseFloat(l.amount) - 20) < 0.001) || `lançamento: ${l.type} ${l.amount}`;
});

// --- limpeza ---------------------------------------------------------------
try {
  const removidos = await limparRastro();
  console.log(`\nlimpeza: ${criados.referrals.length} indicação(ões), ${criados.withdrawals.length} saque(s), ${removidos} usuário(s)`);
} catch (e) {
  console.log(`\nlimpeza FALHOU: ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
