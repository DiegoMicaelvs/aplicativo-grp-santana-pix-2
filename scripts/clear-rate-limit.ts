#!/usr/bin/env tsx
/**
 * Limpa o rate limiting de login
 */

import { db } from "../db/index";

async function clearRateLimit() {
  console.log("=== LIMPANDO RATE LIMIT ===\n");

  try {
    // Limpar todas as tentativas de login da tabela login_attempts
    const result = await db.execute(`
      DELETE FROM login_attempts 
      WHERE created_at < NOW()
    `);
    
    console.log("✅ Rate limit limpo com sucesso!");
    console.log("🔓 Você pode tentar fazer login novamente");
    
    // Verificar se a tabela existe
    const tableCheck = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'login_attempts'
      );
    `);
    
    console.log("\n📝 CREDENCIAIS DO ADMIN:");
    console.log("   Email: admin@kongpix.com.br");
    console.log("   Senha: admin123");
    
  } catch (error: any) {
    if (error.message.includes('does not exist')) {
      console.log("✅ Não há rate limiting ativo no momento");
      console.log("🔓 Você já pode fazer login");
      
      console.log("\n📝 CREDENCIAIS DO ADMIN:");
      console.log("   Email: admin@kongpix.com.br");
      console.log("   Senha: admin123");
    } else {
      console.error("❌ Erro:", error.message);
    }
  }
}

clearRateLimit();