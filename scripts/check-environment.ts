#!/usr/bin/env tsx
/**
 * Script para verificar configurações de ambiente e banco de dados
 * Ajuda a diagnosticar problemas de login entre desenvolvimento e produção
 */

import { db } from "../db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";

console.log("=== VERIFICAÇÃO DE AMBIENTE ===\n");

// Verificar variáveis de ambiente
console.log("1. VARIÁVEIS DE AMBIENTE:");
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'não definido (desenvolvimento)'}`);
console.log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? 'definido' : 'não definido'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'definido' : 'não definido'}`);
console.log(`   REPL_ID: ${process.env.REPL_ID ? 'definido' : 'não definido'}`);
console.log(`   REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || 'não definido'}`);

// Verificar banco de dados
console.log("\n2. INFORMAÇÕES DO BANCO DE DADOS:");
try {
  // Contar usuários
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  console.log(`   Total de usuários: ${userCount[0].count}`);
  
  // Listar últimos 5 usuários
  const recentUsers = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt
  })
  .from(users)
  .orderBy(users.createdAt)
  .limit(5);
  
  console.log("\n   Últimos usuários criados:");
  recentUsers.forEach(user => {
    console.log(`   - ${user.username} (${user.role}) - ${user.createdAt}`);
  });
  
  // Verificar tabela de sessões
  const sessionTable = await db.execute(sql`
    SELECT COUNT(*) as count FROM session
  `);
  console.log(`\n   Sessões ativas: ${sessionTable.rows[0].count}`);
  
} catch (error) {
  console.error("   Erro ao acessar banco de dados:", error);
}

console.log("\n3. DIAGNÓSTICO:");
if (process.env.NODE_ENV !== 'production' && process.env.REPLIT_DEPLOYMENT) {
  console.log("   ⚠️  AVISO: Está em produção mas NODE_ENV não está definido como 'production'");
  console.log("   Isso causará problemas com cookies e sessões!");
}

if (!process.env.SESSION_SECRET) {
  console.log("   ⚠️  AVISO: SESSION_SECRET não está definido");
  console.log("   Isso pode causar problemas de persistência de sessão!");
}

console.log("\n=== FIM DA VERIFICAÇÃO ===");
process.exit(0);