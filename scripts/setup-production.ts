#!/usr/bin/env tsx
/**
 * Script para configurar o sistema em modo de produção
 * Configura variáveis de ambiente, verifica banco de dados e ativa todas as funcionalidades
 */

import { db } from "../db";
import { users, companies, auditLog } from "../shared/schema";
import { sql } from "drizzle-orm";

console.log("=== CONFIGURAÇÃO DO MODO DE PRODUÇÃO ===\n");

async function setupProduction() {
  try {
    // 1. Verificar configuração de ambiente
    console.log("1. VERIFICANDO CONFIGURAÇÃO DE AMBIENTE:");
    
    const isProduction = process.env.NODE_ENV === "production" || 
                        process.env.PRODUCTION_MODE === "true" ||
                        process.env.REPLIT_DEPLOYMENT === "1";
    
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
    console.log(`   PRODUCTION_MODE: ${process.env.PRODUCTION_MODE || 'não definido'}`);
    console.log(`   MASTER_PASSWORD: ${process.env.MASTER_PASSWORD ? 'configurado' : 'NÃO CONFIGURADO'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'configurado' : 'NÃO CONFIGURADO'}`);
    console.log(`   Modo detectado: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}\n`);
    
    if (!isProduction) {
      console.log("⚠️  AVISO: Sistema não está em modo de produção!");
      console.log("   Configure NODE_ENV=production ou PRODUCTION_MODE=true\n");
    }
    
    // 2. Verificar conexão com banco de dados
    console.log("2. VERIFICANDO BANCO DE DADOS:");
    
    const dbTest = await db.select({ count: sql<number>`count(*)` }).from(users);
    console.log(`   Conexão: OK`);
    console.log(`   Total de usuários: ${dbTest[0].count}`);
    
    // 3. Verificar tabelas essenciais
    const tablesCheck = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(companies),
      db.select({ count: sql<number>`count(*)` }).from(auditLog)
    ]);
    
    console.log(`   Usuários: ${tablesCheck[0][0].count}`);
    console.log(`   Empresas: ${tablesCheck[1][0].count}`);
    console.log(`   Logs de auditoria: ${tablesCheck[2][0].count}\n`);
    
    // 4. Configurar empresas padrão se não existirem
    console.log("3. CONFIGURANDO EMPRESAS PADRÃO:");
    
    const existingCompanies = await db.query.companies.findMany();
    if (existingCompanies.length === 0) {
      const defaultCompanies = [
        { name: "Kong Pix Proteção Veicular", isActive: true },
        { name: "Outra Empresa", isActive: true },
        { name: "Sem Seguradora", isActive: true }
      ];
      
      await db.insert(companies).values(defaultCompanies);
      console.log(`   ✅ ${defaultCompanies.length} empresas padrão criadas`);
    } else {
      console.log(`   ✅ ${existingCompanies.length} empresas já configuradas`);
    }
    
    // 5. Verificar usuário admin
    console.log("\n4. VERIFICANDO USUÁRIO ADMIN:");
    
    const adminUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.role, 'admin')
    });
    
    if (adminUsers.length === 0) {
      console.log("   ⚠️  NENHUM USUÁRIO ADMIN ENCONTRADO!");
      console.log("   Execute: tsx scripts/create-production-admin.ts");
    } else {
      console.log(`   ✅ ${adminUsers.length} usuário(s) admin encontrado(s)`);
      adminUsers.forEach(admin => {
        console.log(`      - ${admin.fullName} (${admin.username})`);
      });
    }
    
    // 6. Status final
    console.log("\n=== STATUS FINAL ===");
    console.log(`✅ Banco de dados: Conectado e configurado`);
    console.log(`${isProduction ? '✅' : '⚠️'} Modo de produção: ${isProduction ? 'ATIVO' : 'INATIVO'}`);
    console.log(`✅ Empresas: Configuradas`);
    console.log(`${adminUsers.length > 0 ? '✅' : '⚠️'} Admin: ${adminUsers.length > 0 ? 'Configurado' : 'NECESSÁRIO'}`);
    
    if (isProduction && adminUsers.length > 0) {
      console.log("\n🎉 SISTEMA PRONTO PARA PRODUÇÃO!");
    } else {
      console.log("\n⚠️  Configurações pendentes para produção completa");
    }
    
  } catch (error) {
    console.error("❌ Erro durante configuração:", error);
    process.exit(1);
  }
}

setupProduction().then(() => {
  console.log("\n✅ Configuração de produção concluída");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Falha na configuração:", error);
  process.exit(1);
});