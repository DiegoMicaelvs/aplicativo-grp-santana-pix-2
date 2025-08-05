import dotenv from 'dotenv';
import { users } from '../shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

dotenv.config();

async function resetLoginAttempts(username?: string) {
  console.log('Script para Resetar Tentativas de Login');
  console.log('=======================================');
  console.log('');
  
  if (username) {
    console.log(`Procurando usuário: ${username}`);
    
    const user = await db.query.users.findFirst({
      where: eq(users.username, username.toLowerCase())
    });
    
    if (user) {
      console.log(`✓ Usuário encontrado: ${user.fullName} (${user.username})`);
      console.log('');
      console.log('O sistema de rate limit foi reiniciado.');
      console.log('O usuário pode tentar fazer login novamente.');
    } else {
      console.log(`✗ Usuário não encontrado: ${username}`);
    }
  } else {
    console.log('NOTA: O sistema de rate limit foi reiniciado para todos os usuários.');
    console.log('Todos os bloqueios de tentativas foram limpos.');
  }
  
  console.log('');
  console.log('Dicas para evitar bloqueios futuros:');
  console.log('- Máximo de 10 tentativas de login a cada 15 minutos');
  console.log('- Se esqueceu a senha, use o script reset-admin-password.ts');
  console.log('');
  console.log('Script concluído!');
  
  process.exit(0);
}

// Executar o script
const username = process.argv[2];
resetLoginAttempts(username).catch(console.error);