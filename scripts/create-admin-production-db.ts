#!/usr/bin/env tsx
/**
 * Script para criar usuário admin no banco de dados de produção
 * Execute este script no console do Replit Deploy
 */

import { db } from "../db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { promisify } from "util";
import { sql } from "drizzle-orm";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminInProduction() {
  console.log("=== CRIANDO ADMIN NO BANCO DE DADOS DE PRODUÇÃO ===\n");
  
  // Verificar ambiente
  const environment = process.env.REPLIT_DEPLOYMENT_ID ? "PRODUÇÃO" : "PREVIEW";
  console.log(`📍 Ambiente detectado: ${environment}`);
  
  if (environment !== "PRODUÇÃO") {
    console.log("\n⚠️  ATENÇÃO: Este script deve ser executado no console do Deploy!");
    console.log("   Os dados serão criados no banco local, não no de produção.");
  }
  
  const adminData = {
    username: "admin@kongpix.com.br",
    password: "admin123",
    fullName: "Administrador Kong Pix",
    cpf: "00000000001",
    email: "admin@kongpix.com.br",
    phone: "00000000001",
    address: "Sede Kong Pix - Centro",
    shirtSize: "M",
    pixKey: "admin@kongpix.com.br",
    role: "admin" as const,
    isActive: true,
    balance: "0.00",
    totalEarnings: "0.00",
    mustChangePassword: false
  };
  
  try {
    // Verificar conexão com banco
    const dbInfo = await db.execute(sql`SELECT current_database(), current_user, version()`);
    console.log("\n📊 Informações do Banco:");
    console.log(`   Database: ${dbInfo.rows[0].current_database}`);
    console.log(`   User: ${dbInfo.rows[0].current_user}`);
    
    // Verificar se já existe
    const existing = await db.query.users.findFirst({
      where: eq(users.username, adminData.username)
    });
    
    if (existing) {
      console.log(`\n❌ Usuário admin já existe!`);
      console.log(`   ID: ${existing.id}`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   Ativo: ${existing.isActive ? "Sim" : "Não"}`);
      console.log(`   Criado em: ${existing.createdAt}`);
      
      // Perguntar se quer redefinir senha
      console.log("\n🔄 Redefinindo senha e ativando usuário...");
      
      const hashedPassword = await hashPassword(adminData.password);
      await db.update(users)
        .set({ 
          password: hashedPassword,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, existing.id));
      
      console.log("\n✅ Senha redefinida e usuário ativado!");
      console.log(`📧 Email: ${adminData.username}`);
      console.log(`🔑 Nova senha: ${adminData.password}`);
      
    } else {
      // Criar novo admin
      console.log("\n➕ Criando novo usuário admin...");
      
      const hashedPassword = await hashPassword(adminData.password);
      const [newAdmin] = await db.insert(users).values({
        ...adminData,
        password: hashedPassword
      }).returning();
      
      console.log("\n✅ ADMIN CRIADO COM SUCESSO!");
      console.log("═".repeat(50));
      console.log(`📧 Email/Username: ${adminData.username}`);
      console.log(`🔑 Senha: ${adminData.password}`);
      console.log(`🆔 ID: ${newAdmin.id}`);
      console.log(`📅 Criado em: ${new Date().toLocaleString('pt-BR')}`);
      console.log("═".repeat(50));
    }
    
    // Listar todos os admins no banco
    console.log("\n📋 Todos os administradores no banco:");
    const allAdmins = await db.query.users.findMany({
      where: eq(users.role, "admin"),
      columns: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        createdAt: true
      }
    });
    
    allAdmins.forEach(admin => {
      console.log(`   - ${admin.username} (ID: ${admin.id}) - Ativo: ${admin.isActive ? "✓" : "✗"}`);
    });
    
    console.log("\n🌐 URL de acesso: https://indique.replit.app");
    console.log("🔓 Use as credenciais acima para fazer login");
    
  } catch (error) {
    console.error("\n❌ Erro ao criar admin:", error);
    console.error("\nDetalhes:", error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executar
createAdminInProduction();