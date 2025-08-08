#!/usr/bin/env tsx
/**
 * Script para criar usuário admin no ambiente de produção
 * Este script deve ser executado no console do Replit Deploy
 */

import { db } from "../db";
import { users } from "../shared/schema";
import crypto from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createProductionAdmin() {
  console.log("=== CRIANDO ADMIN NO AMBIENTE DE PRODUÇÃO ===\n");
  
  const adminData = {
    username: "admin@kongpix.com.br",
    password: "admin123",
    fullName: "Administrador Metis da Pix",
    cpf: "00000000001",
    email: "admin@metisbrasil.com.br",
    phone: "00000000001",
    address: "Sede Metis Brasil - Av. Otacílio Negrão de Lima, 800 - São Luiz, Belo Horizonte - MG - 30.270-802",
    city: "São Paulo",
    state: "SP", 
    zipCode: "01000-000",
    shirtSize: "M",
    pixKey: "admin@kongpix.com.br",
    role: "admin" as const,
    isActive: true,
    balance: "0.00",
    totalEarnings: "0.00"
  };
  
  try {
    // Verificar se já existe
    const existing = await db.query.users.findFirst({
      where: eq(users.username, adminData.username)
    });
    
    if (existing) {
      console.log(`❌ Usuário admin já existe com ID: ${existing.id}`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   Criado em: ${existing.createdAt}`);
      
      console.log("\n💡 Dica: Se esqueceu a senha, use:");
      console.log(`   cd scripts && tsx reset-admin-password.ts ${adminData.username} nova-senha`);
      return;
    }
    
    // Hash da senha
    const hashedPassword = await hashPassword(adminData.password);
    
    // Criar usuário
    const [newAdmin] = await db.insert(users).values({
      ...adminData,
      password: hashedPassword
    }).returning();
    
    console.log("✅ ADMIN CRIADO COM SUCESSO!");
    console.log("─".repeat(40));
    console.log(`📧 Email/Username: ${adminData.username}`);
    console.log(`🔑 Senha: ${adminData.password}`);
    console.log(`🆔 ID: ${newAdmin.id}`);
    console.log(`📅 Criado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log("─".repeat(40));
    console.log("\n🌐 Acesse: https://indique.replit.app");
    console.log("🔓 Faça login com as credenciais acima");
    
  } catch (error) {
    console.error("❌ Erro ao criar admin:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executar
createProductionAdmin();