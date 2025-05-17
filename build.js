import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function runCommand(command) {
  console.log(`Executando: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`Erro ao executar o comando: ${command}`);
    console.error(error.message);
    // Continuar mesmo com erros
  }
}

async function createSessionTable() {
  console.log('Criando tabela de sessão no banco de dados...');
  
  try {
    // Verificar se DATABASE_URL está definido
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está definido');
    }
    
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Criar tabela de sessão se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
    `);

    console.log('Tabela de sessão criada com sucesso');
    await pool.end();
  } catch (error) {
    console.error('Erro ao criar tabela de sessão:', error);
  }
}

async function build() {
  try {
    // Etapa 1: Verificar e criar diretório dist se não existir
    await fs.mkdir('dist', { recursive: true });
    
    // Etapa 2: Limpar diretório de build anterior
    console.log('Limpando diretório de build...');
    await runCommand('rm -rf dist/*');
    
    // Etapa 3: Compilar o frontend com Vite
    console.log('Compilando frontend...');
    await runCommand('vite build');
    
    // Etapa 4: Compilar o backend com esbuild
    console.log('Compilando backend...');
    await runCommand('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
    
    // Etapa 5: Atualizar o esquema do banco de dados
    console.log('Atualizando esquema do banco de dados...');
    await runCommand('drizzle-kit push --force --config=./drizzle.config.ts');
    
    // Etapa 6: Criar tabela de sessão
    await createSessionTable();
    
    console.log('Build concluído com sucesso! 🚀');
  } catch (error) {
    console.error('Erro durante o processo de build:', error);
    process.exit(1);
  }
}

build();