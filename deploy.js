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
    return true;
  } catch (error) {
    console.error(`Erro ao executar o comando: ${command}`);
    console.error(error.message);
    return false;
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

async function deploy() {
  try {
    console.log('=== PREPARANDO APLICAÇÃO PARA DEPLOY ===');
    
    // Etapa 1: Executar o comando build existente
    console.log('\n📦 Executando o comando de build...');
    if (!await runCommand('npm run build')) {
      throw new Error('Falha ao executar o build');
    }
    
    // Etapa 2: Atualizar o esquema do banco de dados
    console.log('\n🗄️ Atualizando o banco de dados...');
    await runCommand('npm run db:push');
    
    // Etapa 3: Criar tabela de sessão
    console.log('\n🔒 Verificando tabela de sessão...');
    await createSessionTable();
    
    console.log('\n=== PREPARAÇÃO PARA DEPLOY CONCLUÍDA COM SUCESSO! ===');
    console.log('\n✅ Você pode agora implantar o aplicativo no Replit.');
    console.log('👉 Clique no botão "Deploy" na interface do Replit para finalizar.');
    
  } catch (error) {
    console.error('\n❌ Erro durante o processo de preparação para deploy:', error);
    console.error('Por favor, corrija os erros acima e tente novamente.');
  }
}

deploy();