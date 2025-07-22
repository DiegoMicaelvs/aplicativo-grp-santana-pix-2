#!/usr/bin/env tsx
/**
 * Script para diagnosticar problemas de sincronização entre bancos de dados
 * Preview vs Produção
 */

import { db } from "../db";
import { users, referrals } from "../shared/schema";
import { sql } from "drizzle-orm";

async function diagnoseDatabaseSync() {
  console.log("=== DIAGNÓSTICO DE SINCRONIZAÇÃO DE BANCO DE DADOS ===\n");
  
  // 1. Verificar informações do ambiente
  console.log("1. INFORMAÇÕES DO AMBIENTE:");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
  console.log(`   REPL_SLUG: ${process.env.REPL_SLUG || 'não definido'}`);
  console.log(`   REPLIT_DEPLOYMENT_ID: ${process.env.REPLIT_DEPLOYMENT_ID || 'não definido'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
  console.log(`   REPLIT_DB_URL presente: ${process.env.REPLIT_DB_URL ? 'SIM' : 'NÃO'}\n`);
  
  // 2. Verificar se estamos em produção
  const isProduction = process.env.REPLIT_DEPLOYMENT_ID || 
                      process.env.NODE_ENV === 'production' ||
                      process.env.REPL_SLUG === 'workspace';
  
  console.log(`2. AMBIENTE DETECTADO: ${isProduction ? 'PRODUÇÃO' : 'PREVIEW'}\n`);
  
  // 3. Verificar dados no banco
  console.log("3. DADOS NO BANCO ATUAL:");
  
  try {
    // Contar usuários
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    console.log(`   Total de usuários: ${userCount[0].count}`);
    
    // Listar últimos 5 usuários
    const recentUsers = await db.query.users.findMany({
      limit: 5,
      orderBy: (users, { desc }) => [desc(users.createdAt)]
    });
    
    console.log("\n   Últimos 5 usuários cadastrados:");
    for (const user of recentUsers) {
      console.log(`   - ${user.username} (${user.role}) - Criado em: ${user.createdAt}`);
    }
    
    // Contar indicações
    const referralCount = await db.select({ count: sql<number>`count(*)` }).from(referrals);
    console.log(`\n   Total de indicações: ${referralCount[0].count}`);
    
  } catch (error) {
    console.error("   ERRO ao acessar banco de dados:", error);
  }
  
  // 4. Verificar configuração de banco
  console.log("\n4. ANÁLISE DO PROBLEMA:");
  console.log("   O Replit usa bancos de dados diferentes para:");
  console.log("   - Preview (desenvolvimento): Banco local do Repl");
  console.log("   - Produção (publicado): Banco criado no deploy");
  console.log("\n   Isso explica porque usuários criados em um ambiente");
  console.log("   não aparecem no outro - são bancos completamente separados!");
  
  // 5. Soluções possíveis
  console.log("\n5. SOLUÇÕES POSSÍVEIS:");
  console.log("   a) Usar sempre o ambiente publicado para cadastros reais");
  console.log("   b) Implementar sincronização manual entre os bancos");
  console.log("   c) Usar um banco externo compartilhado (ex: Neon, Supabase)");
  console.log("   d) Exportar/importar dados quando necessário");
  
  console.log("\n=== FIM DO DIAGNÓSTICO ===");
}

diagnoseDatabaseSync().catch(console.error);