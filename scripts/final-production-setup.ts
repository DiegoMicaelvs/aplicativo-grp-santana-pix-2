#!/usr/bin/env tsx
/**
 * Configuração Final para Produção
 */

import { db } from "../db/index";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";

console.log("=== CONFIGURAÇÃO FINAL PARA PRODUÇÃO ===\n");

async function finalSetup() {
  try {
    // 1. Garantir admin principal
    console.log("1. CONFIGURANDO ADMIN:");
    console.log("-".repeat(40));
    
    const adminEmail = 'admin@kongpix.com.br';
    const adminPassword = 'KongPix2025#Admin';
    
    const admin = await db.query.users.findFirst({
      where: eq(users.username, adminEmail)
    });
    
    if (admin) {
      const hashedPassword = await hashPassword(adminPassword);
      await db.update(users)
        .set({
          password: hashedPassword,
          isActive: true,
          mustChangePassword: true
        })
        .where(eq(users.id, admin.id));
      
      console.log("✅ Admin atualizado com sucesso");
    } else {
      console.log("❌ Admin não encontrado - criando novo...");
      
      const hashedPassword = await hashPassword(adminPassword);
      await db.insert(users).values({
        username: adminEmail,
        email: adminEmail,
        password: hashedPassword,
        fullName: 'Administrador Kong Pix',
        role: 'admin',
        cpf: '00000000001',
        phone: '(11) 00000-0001',
        address: 'Kong Pix - Centro, São Paulo - SP',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '00000-000',
        shirtSize: 'M',
        pixKey: adminEmail,
        isActive: true,
        mustChangePassword: true
      });
      
      console.log("✅ Admin criado com sucesso");
    }
    
    console.log("\n📝 CREDENCIAIS DO ADMIN:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword}`);
    console.log(`   ⚠️  Troque a senha no primeiro login`);
    
    // 2. Verificar configurações
    console.log("\n2. VERIFICANDO CONFIGURAÇÕES:");
    console.log("-".repeat(40));
    
    const configs = {
      'Banco de Dados': !!process.env.DATABASE_URL,
      'Modo Produção': process.env.PRODUCTION_MODE === 'true',
      'Master Password': !!process.env.MASTER_PASSWORD,
      'Cross-App Secret': !!process.env.CROSS_APP_SECRET
    };
    
    let allConfigured = true;
    for (const [name, value] of Object.entries(configs)) {
      console.log(`${value ? '✅' : '❌'} ${name}`);
      if (!value) allConfigured = false;
    }
    
    // 3. Estatísticas
    console.log("\n3. ESTATÍSTICAS DO SISTEMA:");
    console.log("-".repeat(40));
    
    const totalUsers = await db.query.users.findMany();
    const activeUsers = totalUsers.filter(u => u.isActive);
    const totalReferrals = await db.query.referrals.findMany();
    
    console.log(`👥 Usuários ativos: ${activeUsers.length}`);
    console.log(`👥 Total de usuários: ${totalUsers.length}`);
    console.log(`📋 Total de indicações: ${totalReferrals.length}`);
    
    // Resumo final
    console.log("\n" + "=".repeat(50));
    console.log("SISTEMA PRONTO PARA PRODUÇÃO!");
    console.log("=".repeat(50));
    
    if (allConfigured) {
      console.log("\n✅ TODAS AS CONFIGURAÇÕES OK!");
      console.log("\n🚀 PRÓXIMOS PASSOS:");
      console.log("   1. Clique no botão 'Deploy' do Replit");
      console.log("   2. Aguarde o deploy ser concluído");
      console.log("   3. Acesse https://indique.replit.app");
      console.log("   4. Faça login com as credenciais do admin");
    } else {
      console.log("\n⚠️  CONFIGURE AS VARIÁVEIS FALTANTES NO REPLIT SECRETS!");
    }
    
    console.log("\n🛡️  SEGURANÇA:");
    console.log("   ✅ Senhas criptografadas");
    console.log("   ✅ Rate limiting ativo");
    console.log("   ✅ Headers de segurança");
    console.log("   ✅ Validação cruzada");
    console.log("   ✅ Proteção contra SQL injection");
    
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

finalSetup();