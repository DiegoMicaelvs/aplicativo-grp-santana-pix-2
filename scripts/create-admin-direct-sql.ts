#!/usr/bin/env tsx
/**
 * Script para criar admin diretamente via SQL
 * Útil quando outros métodos falham
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminDirectSQL() {
  console.log("=== CRIANDO ADMIN VIA SQL DIRETO ===\n");
  
  try {
    // Primeiro verificar se já existe
    const checkResult = await db.execute(sql`
      SELECT id, username, email, created_at 
      FROM users 
      WHERE username = 'admin@kongpix.com.br'
    `);
    
    if (checkResult.rows && checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      console.log(`❌ Admin já existe no banco de dados!`);
      console.log(`   ID: ${existing.id}`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   Criado em: ${existing.created_at}`);
      return;
    }
    
    // Hash da senha
    const hashedPassword = await hashPassword("admin123");
    
    // Inserir diretamente via SQL
    const insertResult = await db.execute(sql`
      INSERT INTO users (
        username, password, full_name, cpf, email, phone, 
        address, shirt_size, pix_key, role, is_active, 
        balance, total_earnings, must_change_password,
        created_at, updated_at
      ) VALUES (
        'admin@kongpix.com.br',
        ${hashedPassword},
        'Administrador Kong Pix',
        '00000000001',
        'admin@kongpix.com.br',
        '00000000001',
        'Sede Kong Pix - Centro',
        'M',
        'admin@kongpix.com.br',
        'admin',
        true,
        '0.00',
        '0.00',
        false,
        NOW(),
        NOW()
      ) RETURNING id, username, email, created_at
    `);
    
    if (insertResult.rows && insertResult.rows.length > 0) {
      const newAdmin = insertResult.rows[0];
      console.log("✅ ADMIN CRIADO COM SUCESSO NO BANCO DE PRODUÇÃO!");
      console.log("─".repeat(50));
      console.log(`📧 Email/Username: admin@kongpix.com.br`);
      console.log(`🔑 Senha: admin123`);
      console.log(`🆔 ID: ${newAdmin.id}`);
      console.log(`📅 Criado em: ${newAdmin.created_at}`);
      console.log("─".repeat(50));
      console.log("\n🌐 Acesse: https://indique.replit.app");
      console.log("🔓 Faça login com as credenciais acima");
    }
    
  } catch (error) {
    console.error("❌ Erro ao criar admin:", error);
    
    // Se for erro de duplicação, tentar atualizar a senha
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      console.log("\n🔄 Tentando redefinir a senha do admin existente...");
      
      try {
        const hashedPassword = await hashPassword("admin123");
        const updateResult = await db.execute(sql`
          UPDATE users 
          SET password = ${hashedPassword}, 
              is_active = true,
              updated_at = NOW()
          WHERE username = 'admin@kongpix.com.br'
          RETURNING id, username, email
        `);
        
        if (updateResult.rows && updateResult.rows.length > 0) {
          console.log("\n✅ Senha do admin redefinida com sucesso!");
          console.log(`📧 Email: admin@kongpix.com.br`);
          console.log(`🔑 Nova senha: admin123`);
        }
      } catch (updateError) {
        console.error("❌ Erro ao redefinir senha:", updateError);
      }
    }
  }
  
  process.exit(0);
}

// Executar
createAdminDirectSQL();