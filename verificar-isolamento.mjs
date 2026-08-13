/**
 * Um usuário recém-criado enxerga dados de outra pessoa?
 *
 *   node verificar-isolamento.mjs [url]
 *
 * Reproduz o relato: um promotor acabou de ser criado, sem equipe e sem nenhum
 * lead próprio. Ele NÃO pode ver indicação, indicador, saque nem usuário que não
 * seja dele. O teste pergunta ao banco quantos registros existem no total e
 * compara com o que a API entrega para esse promotor — se vier qualquer coisa
 * que não é dele, é vazamento no servidor (e não apenas cache do navegador).
 *
 * Tudo que cria é removido no fim.
 */
import { readFileSync } from 'fs';

const BASE = (process.argv[2] || 'https://www.valida.app.br').replace(/\/$/, '');

const env = readFileSync('.env', 'utf8');
const DB = env.split(/\r?\n/).map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l))
  .replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

const sobras = await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id");
if (sobras.rowCount) console.log(`(limpeza inicial: ${sobras.rowCount} usuario(s))\n`);

let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const NOVO = `isolamento.${marca}@valida.teste`;

function req(caminho, { cookie, metodo = 'GET', corpo } = {}) {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
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
    console.log(`${passou ? 'OK   ' : 'VAZOU'} ${nome}${passou ? '' : `  -> ${r}`}`);
    passou ? ok++ : falhou++;
  } catch (e) { console.log(`ERRO  ${nome} :: ${e.message}`); falhou++; }
}

// Quanto existe no banco, no total (o "universo" que ele NÃO deveria ver)
const totais = {
  indicacoes: (await pool.query('SELECT count(*)::int c FROM public.referrals')).rows[0].c,
  usuarios: (await pool.query('SELECT count(*)::int c FROM public.users')).rows[0].c,
  saques: (await pool.query('SELECT count(*)::int c FROM public.withdrawal_requests')).rows[0].c,
};
console.log(`alvo: ${BASE}`);
console.log(`no banco hoje: ${totais.indicacoes} indicacoes, ${totais.usuarios} usuarios, ${totais.saques} saques\n`);

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('admin nao logou — abortando'); process.exit(1); }

const criar = await req('/api/admin/users', {
  metodo: 'POST', cookie: admin.cookie,
  corpo: {
    fullName: 'Promotor Isolamento', username: NOVO, email: NOVO, password: 'senha123456',
    cpf: '52998224725', phone: '11970000021', address: 'Rua Teste, 21',
    city: 'Sao Paulo', state: 'SP', zipCode: '01001000', shirtSize: 'M',
    pixKey: NOVO, role: 'promotor',
  },
});
if (criar.status !== 201) { console.log('nao criei o promotor:', criar.status, (await criar.text()).slice(0, 200)); process.exit(1); }

const novo = await entrar(NOVO, 'senha123456');
if (!novo.cookie) { console.log('promotor novo nao logou'); process.exit(1); }

const idNovo = (await pool.query('SELECT id FROM public.users WHERE username = $1', [NOVO])).rows[0].id;

/** Lê a rota e devolve o array de itens (aceita array puro ou {data:[...]}). */
async function lista(caminho, cookie) {
  const r = await req(caminho, { cookie });
  if (r.status !== 200) return { status: r.status, itens: null };
  const j = await r.json().catch(() => null);
  const itens = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.referrals) ? j.referrals : null;
  return { status: r.status, itens, bruto: j };
}

await checar('indicacoes: promotor novo nao ve lead de ninguem', async () => {
  const { status, itens } = await lista('/api/referrals', novo.cookie);
  if (status !== 200) return `status ${status}`;
  if (itens === null) return 'resposta em formato inesperado';
  return itens.length === 0 || `recebeu ${itens.length} indicacao(oes) sendo que nao tem nenhuma (existem ${totais.indicacoes} no banco)`;
});

await checar('equipe: promotor novo nao ve indicacao de outra equipe', async () => {
  const { status, itens } = await lista('/api/promoter/team-referrals', novo.cookie);
  if (status !== 200) return `status ${status}`;
  if (itens === null) return 'resposta em formato inesperado';
  return itens.length === 0 || `recebeu ${itens.length} indicacao(oes) de equipe sem ter equipe`;
});

await checar('indicadores: promotor novo nao ve indicador de outro promotor', async () => {
  const { status, itens } = await lista('/api/users/indicadores', novo.cookie);
  if (status !== 200) return `status ${status}`;
  if (itens === null) return 'resposta em formato inesperado';
  const alheios = itens.filter((u) => u.promoterId !== idNovo);
  return alheios.length === 0 || `recebeu ${alheios.length} indicador(es) de outro promotor: ${alheios.map((u) => u.fullName).slice(0, 3).join(', ')}`;
});

await checar('supervisores: so os da propria equipe', async () => {
  const { status, itens } = await lista('/api/promoter/supervisors', novo.cookie);
  if (status !== 200) return `status ${status}`;
  if (itens === null) return 'resposta em formato inesperado';
  const alheios = itens.filter((u) => u.promoterId !== idNovo);
  return alheios.length === 0 || `recebeu ${alheios.length} supervisor(es) de outra equipe`;
});

await checar('painel de admin continua fechado para promotor', async () => {
  const rotas = ['/api/admin/users', '/api/admin/withdrawals', '/api/admin/referrals', '/api/admin/audit-log'];
  const abertas = [];
  for (const rota of rotas) {
    const r = await req(rota, { cookie: novo.cookie });
    if (r.status === 200) abertas.push(`${rota} (200)`);
  }
  return abertas.length === 0 || `promotor acessou: ${abertas.join(', ')}`;
});

await checar('saques: promotor novo nao ve saque de terceiro', async () => {
  const { status, itens } = await lista('/api/withdrawals', novo.cookie);
  if (status === 403 || status === 404) return true;
  if (status !== 200) return `status ${status}`;
  if (itens === null) return true;
  const alheios = itens.filter((w) => w.userId && w.userId !== idNovo);
  return alheios.length === 0 || `recebeu ${alheios.length} saque(s) de outra pessoa`;
});

await checar('nenhuma resposta traz hash de senha', async () => {
  for (const rota of ['/api/user', '/api/referrals', '/api/users/indicadores', '/api/promoter/supervisors']) {
    const r = await req(rota, { cookie: novo.cookie });
    if (r.status !== 200) continue;
    const txt = await r.text();
    if (txt.includes('"password"')) return `campo password presente em ${rota}`;
  }
  return true;
});

try {
  const r = await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id");
  console.log(`\nlimpeza: ${r.rowCount} usuario(s) de teste removido(s)`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} vazamento(s)`);
process.exit(falhou > 0 ? 1 : 0);
