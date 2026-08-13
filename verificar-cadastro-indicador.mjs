/**
 * Reproduz o erro do promotor e prova a correção.
 *
 *   node verificar-cadastro-indicador.mjs                        (bundle local)
 *   node verificar-cadastro-indicador.mjs https://valida-six...  (producao)
 *
 * Fluxo: cria um promotor de teste, loga como ele e tenta cadastrar um
 * indicador pelos DOIS caminhos — o antigo (/api/admin/users, que a tela
 * "Cadastrar Indicador" usava) e o novo (/api/promoter/indicators).
 * Confirma ainda que o indicador nasce vinculado ao promotor e que o vínculo é
 * o do promotor logado, não o que o cliente mandar.
 *
 * Tudo que cria é removido no fim.
 */
import { readFileSync } from 'fs';
import { createServer } from 'http';

const env = readFileSync('.env', 'utf8');
const DB = env.split(/\r?\n/).map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l))
  .replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

Object.assign(process.env, {
  DATABASE_URL: DB,
  DATABASE_SSL: 'true',
  DATABASE_POOL_MAX: '5',
  NODE_ENV: 'production',
  VERCEL: '1',
  SESSION_SECRET: 'verificacao-local-apenas',
  MASTER_PASSWORD: 'verificacao-local-apenas',
  APP_TENANT: 'gruposantana',
  TRUST_PROXY: '1',
  LOGIN_MAX_PER_IP: '0',
  REGISTER_MAX_PER_IP: '0',
});

// Sem argumento: sobe o bundle local. Com URL: exercita o deploy publicado.
const alvoExterno = process.argv[2];
let server = null;
let BASE = alvoExterno?.replace(/\/$/, '');

if (!alvoExterno) {
  const { default: handler } = await import('./api/index.js');
  server = createServer((req, res) => handler(req, res));
  await new Promise((r) => server.listen(5098, r));
  BASE = 'http://localhost:5098';
}
console.log(`alvo: ${BASE}\n`);

let ok = 0, falhou = 0;
const marca = String(Date.now()).slice(-8);
const PROMOTOR = `promotor.teste.${marca}@valida.teste`;
const INDICADOR = `indicador.teste.${marca}@valida.teste`;

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
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${nome}${passou ? '' : `  (${r})`}`);
    passou ? ok++ : falhou++;
  } catch (e) { console.log(`FALHA ${nome} :: ${e.message}`); falhou++; }
}

// CPFs válidos (dígitos verificadores corretos) para não esbarrar na validação
const CPF_PROMOTOR = '52998224725';
const CPF_INDICADOR = '15350946056';

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

// Limpa sobras de execuções anteriores ANTES de começar: CPF é UNIQUE, e um
// usuário de teste remanescente faria a criação falhar com 500 sem relação
// nenhuma com o que se quer verificar.
const sobras = await pool.query("DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id");
if (sobras.rowCount) console.log(`(limpeza inicial: ${sobras.rowCount} usuario(s) de teste de execucoes anteriores)\n`);

const admin = await entrar('admin@gruposantana.com', 'admin123');
if (!admin.cookie) { console.log('nao consegui logar como admin — abortando'); process.exit(1); }

await checar('admin cria um promotor de teste', async () => {
  const r = await req('/api/admin/users', {
    metodo: 'POST', cookie: admin.cookie,
    corpo: {
      fullName: 'Promotor Teste', username: PROMOTOR, email: PROMOTOR,
      password: 'senha123456', cpf: CPF_PROMOTOR, phone: '11970000001',
      address: 'Rua Teste, 1', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
      shirtSize: 'M', pixKey: PROMOTOR, role: 'promotor',
    },
  });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
  return true;
});

const promotor = await entrar(PROMOTOR, 'senha123456');
await checar('promotor consegue logar', () => promotor.status === 200 && !!promotor.cookie || `status ${promotor.status}`);

const dadosIndicador = {
  fullName: 'Indicador Teste', username: INDICADOR, email: INDICADOR,
  password: 'senha123456', cpf: CPF_INDICADOR, phone: '11970000002',
  address: 'Rua Teste, 2', city: 'Sao Paulo', state: 'SP', zipCode: '01001000',
  shirtSize: 'G', pixKey: INDICADOR, role: 'indicador',
};

await checar('REPRODUZ O BUG: rota antiga (/api/admin/users) nega o promotor com 403', async () => {
  const r = await req('/api/admin/users', { metodo: 'POST', cookie: promotor.cookie, corpo: dadosIndicador });
  const corpo = await r.text();
  if (r.status !== 403) return `esperava 403, veio ${r.status}`;
  return corpo.includes('Acesso negado') || `403 mas com outra mensagem: ${corpo.slice(0, 120)}`;
});

await checar('CORREÇÃO: rota do promotor (/api/promoter/indicators) cria o indicador', async () => {
  const r = await req('/api/promoter/indicators', { metodo: 'POST', cookie: promotor.cookie, corpo: dadosIndicador });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 250)}`;
  return true;
});

await checar('indicador nasce vinculado ao promotor que o cadastrou', async () => {
  const p = await pool.query('SELECT id FROM public.users WHERE username = $1', [PROMOTOR]);
  const i = await pool.query('SELECT id, role, promoter_id, created_by, pix_key, shirt_size FROM public.users WHERE username = $1', [INDICADOR]);
  if (!i.rows.length) return 'indicador nao encontrado no banco';
  const ind = i.rows[0], idProm = p.rows[0]?.id;
  if (ind.role !== 'indicador') return `role gravado: ${ind.role}`;
  if (ind.promoter_id !== idProm) return `promoter_id ${ind.promoter_id} != promotor ${idProm}`;
  if (ind.created_by !== idProm) return `created_by ${ind.created_by} != promotor ${idProm}`;
  // confirma que os campos de perfil sobreviveram à allowlist do schema
  if (!ind.pix_key || ind.shirt_size !== 'G') return `perfil incompleto: pix=${ind.pix_key} camiseta=${ind.shirt_size}`;
  return true;
});

await checar('CPF e telefone chegam normalizados, mesmo digitados com mascara', async () => {
  const mascarado = `mascara.${marca}@valida.teste`;
  const r = await req('/api/promoter/indicators', {
    metodo: 'POST', cookie: promotor.cookie,
    corpo: {
      ...dadosIndicador,
      username: mascarado, email: mascarado, pixKey: mascarado,
      // exatamente como a tela envia: com a máscara do formulário
      cpf: '111.444.777-35', phone: '(11) 97000-0004',
    },
  });
  if (r.status !== 201) return `esperava 201, veio ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const q = await pool.query('SELECT cpf, phone FROM public.users WHERE username = $1', [mascarado]);
  const u = q.rows[0];
  if (u.cpf !== '11144477735') return `cpf gravado com mascara: ${u.cpf}`;
  if (u.phone !== '11970000004') return `telefone gravado com mascara: ${u.phone}`;
  return true;
});

await checar('CPF invalido e recusado (nao vira conta fantasma)', async () => {
  const ruim = `cpfruim.${marca}@valida.teste`;
  const r = await req('/api/promoter/indicators', {
    metodo: 'POST', cookie: promotor.cookie,
    corpo: { ...dadosIndicador, username: ruim, email: ruim, pixKey: ruim,
             cpf: '111.111.111-11', phone: '11970000005' },
  });
  if (r.status < 400) return `CPF invalido foi aceito (${r.status})`;
  const q = await pool.query('SELECT id FROM public.users WHERE username = $1', [ruim]);
  return q.rows.length === 0 || 'usuario com CPF invalido foi gravado mesmo assim';
});

await checar('promotor nao consegue forjar o vinculo nem o cargo', async () => {
  const outro = `forjado.${marca}@valida.teste`;
  const r = await req('/api/promoter/indicators', {
    metodo: 'POST', cookie: promotor.cookie,
    corpo: { ...dadosIndicador, username: outro, email: outro, pixKey: outro,
             cpf: '12345678909', phone: '11970000003',
             role: 'admin', promoterId: 1, balance: '99999', commissionValidated: '999' },
  });
  if (r.status === 400) return true; // barrado na validação de comissão — também aceitável
  if (r.status !== 201) return `status inesperado ${r.status}: ${(await r.text()).slice(0, 200)}`;
  const q = await pool.query('SELECT role, promoter_id, balance FROM public.users WHERE username = $1', [outro]);
  const u = q.rows[0];
  const prom = await pool.query('SELECT id FROM public.users WHERE username = $1', [PROMOTOR]);
  if (u.role !== 'indicador') return `escalou cargo para ${u.role}`;
  if (u.promoter_id !== prom.rows[0].id) return `forjou promoter_id ${u.promoter_id}`;
  if (parseFloat(u.balance) !== 0) return `forjou saldo ${u.balance}`;
  return true;
});

// limpeza
try {
  const r = await pool.query(
    "DELETE FROM public.users WHERE username LIKE '%@valida.teste' RETURNING id",
  );
  console.log(`\nlimpeza: ${r.rowCount} usuario(s) de teste removido(s)`);
} catch (e) {
  console.log(`\nlimpeza FALHOU (remova usuarios '%@valida.teste'): ${e.message}`);
} finally {
  await pool.end();
}

console.log(`RESULTADO: ${ok} OK / ${falhou} falhas`);
server?.close();
process.exit(falhou > 0 ? 1 : 0);
