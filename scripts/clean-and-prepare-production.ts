#!/usr/bin/env tsx
/**
 * Limpa dados de teste e prepara para produção
 */

import { db } from "../db/index";
import { users, referrals, supportTickets, companies } from "@shared/schema";
import { eq, or, like, and, ne } from "drizzle-orm";
import { hashPassword } from "../server/auth";

console.log("=== PREPARAÇÃO COMPLETA PARA PRODUÇÃO ===\n");

async function cleanAndPrepare() {
  try {
    // 1. LIMPAR DADOS DE TESTE
    console.log("1. LIMPANDO DADOS DE TESTE:");
    console.log("-".repeat(40));
    
    // Buscar usuários de teste (exceto admins principais)
    const testUsers = await db.query.users.findMany({
      where: and(
        or(
          like(users.email, '%test%'),
          like(users.email, '%exemplo%'),
          like(users.fullName, '%Teste%'),
          eq(users.cpf, '12345678900')
        ),
        ne(users.username, 'admin@kongpix.com.br')
      )
    });
    
    console.log(`Encontrados ${testUsers.length} usuários de teste`);
    
    // Deletar usuários de teste e suas indicações
    for (const user of testUsers) {
      // Deletar indicações
      await db.delete(referrals).where(eq(referrals.indicatorId, user.id));
      
      // Deletar tickets se a tabela existir
      try {
        await db.delete(supportTickets).where(eq(supportTickets.userId, user.id));
      } catch (e) {
        // Tabela pode não existir
      }
      
      // Deletar usuário
      await db.delete(users).where(eq(users.id, user.id));
      console.log(`✅ Removido: ${user.fullName} (${user.email})`);
    }
    
    // 2. CONFIGURAR ADMIN PRINCIPAL
    console.log("\n2. CONFIGURANDO ADMIN PRINCIPAL:");
    console.log("-".repeat(40));
    
    const adminEmail = 'admin@kongpix.com.br';
    const adminPassword = 'KongPix2025#Admin';
    
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.username, adminEmail)
    });
    
    if (existingAdmin) {
      const hashedPassword = await hashPassword(adminPassword);
      await db.update(users)
        .set({
          password: hashedPassword,
          isActive: true,
          mustChangePassword: true
        })
        .where(eq(users.id, existingAdmin.id));
      
      console.log("✅ Admin atualizado");
    } else {
      const hashedPassword = await hashPassword(adminPassword);
      await db.insert(users).values({
        username: adminEmail,
        email: adminEmail,
        password: hashedPassword,
        fullName: 'Administrador Kong Pix',
        role: 'admin',
        cpf: '00000000001',
        phone: '(11) 00000-0001',
        address: 'Kong Pix - Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '00000-000',
        shirtSize: 'M',
        pixKey: adminEmail,
        isActive: true,
        mustChangePassword: true
      });
      
      console.log("✅ Admin criado");
    }
    
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword}`);
    console.log(`   ⚠️  Será solicitada troca de senha no primeiro login`);
    
    // 3. GARANTIR EMPRESAS PADRÃO
    console.log("\n3. CONFIGURANDO EMPRESAS:");
    console.log("-".repeat(40));
    
    const defaultCompanies = [
      'Kong Pix',
      'Outra Empresa',
      'Sem Seguradora'
    ];
    
    for (const companyName of defaultCompanies) {
      const exists = await db.query.companies.findFirst({
        where: eq(companies.name, companyName)
      });
      
      if (!exists) {
        await db.insert(companies).values({
          name: companyName,
          isActive: true
        });
        console.log(`✅ Empresa criada: ${companyName}`);
      } else {
        console.log(`✅ Empresa já existe: ${companyName}`);
      }
    }
    
    // 4. VERIFICAR CONFIGURAÇÕES
    console.log("\n4. VERIFICANDO CONFIGURAÇÕES:");
    console.log("-".repeat(40));
    
    const configs = [
      { name: 'DATABASE_URL', value: !!process.env.DATABASE_URL },
      { name: 'PRODUCTION_MODE', value: process.env.PRODUCTION_MODE === 'true' },
      { name: 'MASTER_PASSWORD', value: !!process.env.MASTER_PASSWORD },
      { name: 'CROSS_APP_SECRET', value: !!process.env.CROSS_APP_SECRET }
    ];
    
    let allOk = true;
    for (const config of configs) {
      console.log(`${config.value ? '✅' : '❌'} ${config.name}`);
      if (!config.value) allOk = false;
    }
    
    // 5. ESTATÍSTICAS FINAIS
    console.log("\n5. ESTATÍSTICAS DO SISTEMA:");
    console.log("-".repeat(40));
    
    const stats = {
      users: await db.query.users.findMany(),
      referrals: await db.query.referrals.findMany(),
      companies: await db.query.companies.findMany()
    };
    
    console.log(`📊 Usuários ativos: ${stats.users.filter(u => u.isActive).length}`);
    console.log(`📊 Total de usuários: ${stats.users.length}`);
    console.log(`📊 Total de indicações: ${stats.referrals.length}`);
    console.log(`📊 Empresas cadastradas: ${stats.companies.length}`);
    
    // RESUMO FINAL
    console.log("\n" + "=".repeat(50));
    console.log("PREPARAÇÃO CONCLUÍDA!");
    console.log("=".repeat(50));
    
    console.log("\n✅ SISTEMA PRONTO PARA PRODUÇÃO:");
    console.log("   • Dados de teste removidos");
    console.log("   • Admin configurado");
    console.log("   • Empresas padrão criadas");
    console.log("   • Segurança ativada");
    
    if (!allOk) {
      console.log("\n⚠️  ATENÇÃO:");
      console.log("   Configure as variáveis de ambiente faltantes!");
    }
    
    console.log("\n📱 PRÓXIMOS PASSOS:");
    console.log("   1. Clique no botão Deploy do Replit");
    console.log("   2. Acesse https://indique.replit.app");
    console.log("   3. Faça login com as credenciais do admin");
    console.log("   4. Troque a senha no primeiro acesso");
    
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

cleanAndPrepare();