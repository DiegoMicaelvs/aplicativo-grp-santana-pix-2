#!/usr/bin/env tsx
/**
 * Script para criar/atualizar diego@gruposantana.com.br como admin
 */

import { db } from "../db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createOrUpdateDiegoAdmin() {
  console.log("=== CONFIGURANDO DIEGO@GRUPOSANTANA.COM.BR COMO ADMIN ===\n");
  
  const userData = {
    username: "diego@gruposantana.com.br",
    password: "admin123", // Senha padrão
    fullName: "Diego - Grupo Santana",
    cpf: "00000000002",
    email: "diego@gruposantana.com.br",
    phone: "00000000002",
    address: "Grupo Santana - Administração",
    shirtSize: "M",
    pixKey: "diego@gruposantana.com.br",
    role: "admin" as const,
    isActive: true,
    balance: "0.00",
    totalEarnings: "0.00",
    mustChangePassword: false
  };
  
  try {
    // Verificar se já existe
    const existing = await db.query.users.findFirst({
      where: eq(users.username, userData.username)
    });
    
    if (existing) {
      console.log(`🔄 Usuário encontrado. Atualizando para admin...`);
      
      // Hash da nova senha
      const hashedPassword = await hashPassword(userData.password);
      
      // Atualizar para admin
      await db.update(users)
        .set({ 
          role: "admin",
          password: hashedPassword,
          isActive: true,
          mustChangePassword: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, existing.id));
      
      console.log("\n✅ USUÁRIO ATUALIZADO PARA ADMIN!");
      console.log("─".repeat(50));
      console.log(`📧 Email/Username: ${userData.username}`);
      console.log(`🔑 Senha: ${userData.password}`);
      console.log(`🆔 ID: ${existing.id}`);
      console.log(`👤 Perfil anterior: ${existing.role}`);
      console.log(`👤 Perfil novo: admin`);
      console.log("─".repeat(50));
    } else {
      console.log(`➕ Usuário não existe. Criando como admin...`);
      
      // Hash da senha
      const hashedPassword = await hashPassword(userData.password);
      
      // Criar usuário
      const [newAdmin] = await db.insert(users).values({
        ...userData,
        password: hashedPassword
      }).returning();
      
      console.log("\n✅ ADMIN CRIADO COM SUCESSO!");
      console.log("─".repeat(50));
      console.log(`📧 Email/Username: ${userData.username}`);
      console.log(`🔑 Senha: ${userData.password}`);
      console.log(`🆔 ID: ${newAdmin.id}`);
      console.log(`📅 Criado em: ${new Date().toLocaleString('pt-BR')}`);
      console.log("─".repeat(50));
    }
    
    console.log("\n🌐 Acesse: https://indique.replit.app");
    console.log("🔓 Faça login com as credenciais acima");
    console.log("\n⚠️  IMPORTANTE: Execute este script no console do Deploy");
    console.log("   para afetar o banco de produção!");
    
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executar
createOrUpdateDiegoAdmin();