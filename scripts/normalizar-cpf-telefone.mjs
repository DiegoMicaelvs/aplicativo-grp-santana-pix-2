/**
 * Normaliza CPF e telefone dos usuários JÁ gravados.
 *
 *   node scripts/normalizar-cpf-telefone.mjs           (só relata)
 *   node scripts/normalizar-cpf-telefone.mjs --aplicar (grava)
 *
 * As rotas dos painéis internos gravavam o valor como o formulário mandava, com
 * máscara ("292.495.128-30", "(11) 97000-0010"). Como CPF é UNIQUE e o telefone
 * é comparado por igualdade exata na checagem de indicação duplicada, o mesmo
 * cadastro passava duas vezes. A entrada nova já é normalizada em
 * storage.createUser; este script acerta o que ficou para trás.
 *
 * Não inventa dado: só remove separadores. CPF cujos dígitos verificadores não
 * fecham é apenas RELATADO — corrigir exigiria saber o número certo.
 */
import { readFileSync } from 'fs';
import { normalizarCpf, cpfEhValido, normalizarTelefone } from '../shared/cpf.ts';

const APLICAR = process.argv.includes('--aplicar');

const env = readFileSync('.env', 'utf8');
const DB = env.split(/\r?\n/).map((l) => l.trim())
  .find((l) => /^#?\s*DATABASE_URL=postgresql:\/\/postgres\.cnacpu/.test(l))
  .replace(/^#\s*/, '').replace(/^DATABASE_URL=/, '').trim();

const { Pool } = (await import('pg')).default;
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query('SELECT id, full_name, cpf, phone FROM public.users ORDER BY id');

const mudancas = [];
const invalidos = [];

for (const u of rows) {
  const cpfNovo = normalizarCpf(u.cpf ?? '');
  const telNovo = normalizarTelefone(u.phone ?? '');
  if (!cpfEhValido(cpfNovo)) invalidos.push({ id: u.id, nome: u.full_name, cpf: u.cpf });
  if (cpfNovo !== u.cpf || telNovo !== u.phone) {
    mudancas.push({ id: u.id, nome: u.full_name, cpfDe: u.cpf, cpfPara: cpfNovo, telDe: u.phone, telPara: telNovo });
  }
}

if (!mudancas.length) {
  console.log('Nada a normalizar — todos os CPFs e telefones já estão só com dígitos.');
} else {
  console.log(`${mudancas.length} registro(s) a normalizar:`);
  console.table(mudancas);

  // Normalizar pode revelar duplicata escondida pela máscara: checa ANTES.
  const colisoes = [];
  for (const m of mudancas) {
    const q = await pool.query('SELECT id, full_name FROM public.users WHERE cpf = $1 AND id <> $2', [m.cpfPara, m.id]);
    if (q.rows.length) colisoes.push({ id: m.id, cpf: m.cpfPara, conflitaCom: q.rows.map((r) => `${r.id}:${r.full_name}`).join(', ') });
  }

  if (colisoes.length) {
    console.log('\nATENCAO — normalizar criaria CPF duplicado (a mascara estava escondendo contas repetidas):');
    console.table(colisoes);
    console.log('Resolva essas contas antes de aplicar. Nada foi alterado.');
    await pool.end();
    process.exit(1);
  }

  if (APLICAR) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      for (const m of mudancas) {
        await cliente.query('UPDATE public.users SET cpf = $1, phone = $2 WHERE id = $3', [m.cpfPara, m.telPara, m.id]);
      }
      await cliente.query('COMMIT');
      console.log(`\n${mudancas.length} registro(s) normalizado(s).`);
    } catch (e) {
      await cliente.query('ROLLBACK');
      console.error('\nfalhou, nada foi alterado:', e.message);
      process.exitCode = 1;
    } finally {
      cliente.release();
    }
  } else {
    console.log('\n(simulacao — rode com --aplicar para gravar)');
  }
}

if (invalidos.length) {
  console.log('\nCPF com digito verificador invalido (NAO alterado — precisa do numero correto):');
  console.table(invalidos);
}

await pool.end();
