#!/usr/bin/env tsx
/**
 * Script para limpar sessões antigas do banco de dados
 * Útil para resolver problemas de login entre ambientes
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function cleanSessions() {
  console.log("=== LIMPEZA DE SESSÕES ===\n");
  
  try {
    // Contar sessões antes
    const beforeCount = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
    console.log(`Sessões antes da limpeza: ${beforeCount.rows[0].count}`);
    
    // Limpar sessões com mais de 30 dias
    const result = await db.execute(sql`
      DELETE FROM session 
      WHERE expire < NOW()
      RETURNING sid
    `);
    
    console.log(`\nSessões expiradas removidas: ${result.rows.length}`);
    
    // Contar sessões depois
    const afterCount = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
    console.log(`Sessões após limpeza: ${afterCount.rows[0].count}`);
    
    // Mostrar sessões ativas recentes
    const activeSessions = await db.execute(sql`
      SELECT 
        sid,
        sess->>'passport' as passport,
        expire
      FROM session
      WHERE expire > NOW()
      ORDER BY expire DESC
      LIMIT 5
    `);
    
    console.log("\nSessões ativas recentes:");
    activeSessions.rows.forEach(session => {
      const passport = session.passport ? JSON.parse(session.passport) : null;
      const userId = passport?.user || 'não autenticado';
      console.log(`- Sessão: ${session.sid.substring(0, 20)}... | User ID: ${userId} | Expira: ${session.expire}`);
    });
    
  } catch (error) {
    console.error("Erro ao limpar sessões:", error);
  }
  
  console.log("\n=== LIMPEZA CONCLUÍDA ===");
}

cleanSessions().then(() => process.exit(0));