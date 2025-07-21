#!/usr/bin/env tsx
/**
 * Script para redefinir senha do administrador
 * Útil quando não consegue fazer login
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

async function resetAdminPassword() {
  const username = process.argv[2];
  const newPassword = process.argv[3] || "admin123";
  
  if (!username) {
    console.log("Uso: tsx reset-admin-password.ts <email> [nova-senha]");
    console.log("Exemplo: tsx reset-admin-password.ts admin@kongpix.com.br admin123");
    process.exit(1);
  }
  
  console.log(`\nRedefinindo senha para: ${username}`);
  
  try {
    // Buscar usuário
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });
    
    if (!user) {
      console.error(`Usuário não encontrado: ${username}`);
      process.exit(1);
    }
    
    // Hash da nova senha
    const hashedPassword = await hashPassword(newPassword);
    
    // Atualizar senha
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
    
    console.log(`✓ Senha redefinida com sucesso!`);
    console.log(`  Email: ${username}`);
    console.log(`  Nova senha: ${newPassword}`);
    console.log(`  ID do usuário: ${user.id}`);
    
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

resetAdminPassword();