#!/usr/bin/env tsx
/**
 * Verifica e cria usuário admin se necessário
 */

import { db } from "../db/index";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";

async function checkAndCreateAdmin() {
  console.log("=== VERIFICANDO USUÁRIO ADMIN ===\n");

  try {
    // Verificar se existe admin
    const adminUser = await db.query.users.findFirst({
      where: eq(users.username, "admin@kongpix.com.br")
    });

    if (adminUser) {
      console.log("✅ Usuário admin encontrado:");
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.username}`);
      console.log(`   Nome: ${adminUser.fullName}`);
      console.log(`   Ativo: ${adminUser.isActive ? 'Sim' : 'Não'}`);
      console.log(`   Criado em: ${adminUser.createdAt}`);
      
      // Atualizar senha para garantir que funcione
      console.log("\n🔄 Atualizando senha do admin...");
      const hashedPassword = await hashPassword("admin123");
      
      await db.update(users)
        .set({ 
          password: hashedPassword,
          isActive: true 
        })
        .where(eq(users.id, adminUser.id));
      
      console.log("✅ Senha atualizada com sucesso!");
      console.log("\n📝 CREDENCIAIS:");
      console.log("   Email: admin@kongpix.com.br");
      console.log("   Senha: admin123");
      
    } else {
      console.log("❌ Usuário admin não encontrado");
      console.log("🔄 Criando novo usuário admin...");
      
      const hashedPassword = await hashPassword("admin123");
      
      const [newAdmin] = await db.insert(users).values({
        username: "admin@kongpix.com.br",
        email: "admin@kongpix.com.br",
        password: hashedPassword,
        fullName: "Administrador Kong Pix",
        role: "admin",
        cpf: "00000000000",
        phone: "(00) 00000-0000",
        address: "Sistema",
        city: "Sistema",
        state: "SP",
        zipCode: "00000-000",
        isActive: true,
        createdBy: undefined
      }).returning();
      
      console.log("✅ Admin criado com sucesso!");
      console.log(`   ID: ${newAdmin.id}`);
      console.log("\n📝 CREDENCIAIS:");
      console.log("   Email: admin@kongpix.com.br");
      console.log("   Senha: admin123");
    }
    
    // Verificar outros usuários admin
    console.log("\n🔍 Verificando outros admins:");
    const allAdmins = await db.query.users.findMany({
      where: eq(users.role, "admin")
    });
    
    console.log(`Total de admins: ${allAdmins.length}`);
    allAdmins.forEach(admin => {
      console.log(`   - ${admin.username} (${admin.isActive ? 'Ativo' : 'Inativo'})`);
    });
    
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

checkAndCreateAdmin();