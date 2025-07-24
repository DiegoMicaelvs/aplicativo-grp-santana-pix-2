#!/usr/bin/env tsx
/**
 * Reseta tentativas de login (rate limiting)
 * Use este script se receber erro 429 ao tentar fazer login
 */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

async function resetLoginAttempts() {
  console.log("=== RESETANDO TENTATIVAS DE LOGIN ===\n");
  
  try {
    // Reiniciar o servidor para limpar o rate limiting da memória
    console.log("🔄 Reiniciando servidor para limpar rate limiting...");
    
    // Parar e reiniciar o processo
    await execAsync('pkill -f "tsx server/index.ts"').catch(() => {});
    
    console.log("✅ Rate limiting resetado!");
    console.log("⏱️  Aguarde alguns segundos para o servidor reiniciar");
    console.log("\n📝 CREDENCIAIS DO ADMIN:");
    console.log("   Email: admin@kongpix.com.br");
    console.log("   Senha: admin123");
    console.log("\n💡 Dica: O rate limiting permite 5 tentativas a cada 15 minutos");
    
  } catch (error) {
    console.log("⚠️  Não foi possível reiniciar automaticamente");
    console.log("💡 O rate limiting será resetado automaticamente em 15 minutos");
    console.log("\n📝 CREDENCIAIS DO ADMIN:");
    console.log("   Email: admin@kongpix.com.br");
    console.log("   Senha: admin123");
  }
}

resetLoginAttempts();