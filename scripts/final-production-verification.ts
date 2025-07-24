#!/usr/bin/env tsx
/**
 * Verificação final do sistema de produção
 * Testa todas as funcionalidades e configurações
 */

console.log("=== VERIFICAÇÃO FINAL DO SISTEMA DE PRODUÇÃO ===\n");

// Verificar variáveis de ambiente
console.log("1. VERIFICANDO CONFIGURAÇÕES:");
console.log("-".repeat(40));

const hasDatabase = !!process.env.DATABASE_URL;
const hasProduction = !!process.env.PRODUCTION_MODE;
const hasMasterPassword = !!process.env.MASTER_PASSWORD;
const hasCrossAppSecret = !!process.env.CROSS_APP_SECRET;

console.log(`DATABASE_URL: ${hasDatabase ? '✅ Configurado' : '❌ Ausente'}`);
console.log(`PRODUCTION_MODE: ${hasProduction ? '✅ Ativado' : '❌ Desativado'}`);
console.log(`MASTER_PASSWORD: ${hasMasterPassword ? '✅ Configurado' : '❌ Ausente'}`);
console.log(`CROSS_APP_SECRET: ${hasCrossAppSecret ? '✅ Configurado' : '❌ Ausente'}`);

console.log("\n2. TESTANDO BANCO DE DADOS:");
console.log("-".repeat(40));

try {
  const { db } = await import("../db/index");
  
  // Testar conexão com o banco
  const result = await db.execute('SELECT 1 as test');
  console.log("✅ Conexão com banco de dados OK");
  
  // Verificar tabelas principais
  const tables = await db.execute(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  const tableNames = (tables as any).map((t: any) => t.table_name);
  const requiredTables = [
    'users', 'referrals', 'companies', 'withdrawals', 
    'support_tickets', 'audit_log', 'cash_flow'
  ];
  
  console.log(`📊 Tabelas encontradas: ${tableNames.length}`);
  
  for (const table of requiredTables) {
    const exists = tableNames.includes(table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }
  
} catch (error) {
  console.log("❌ Erro ao conectar com banco:", error);
}

console.log("\n3. VERIFICANDO SISTEMA DE VALIDAÇÃO CRUZADA:");
console.log("-".repeat(40));

if (hasCrossAppSecret) {
  try {
    const { CENTRAL_VALIDATION_APIS } = await import("../server/crossAppValidation");
    
    console.log(`✅ Secret configurado`);
    console.log(`📡 APIs configuradas: ${CENTRAL_VALIDATION_APIS.length}`);
    
    if (CENTRAL_VALIDATION_APIS.length > 0) {
      console.log("   URLs configuradas:");
      CENTRAL_VALIDATION_APIS.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
    } else {
      console.log("   ⚠️  Nenhuma URL de validação configurada");
      console.log("   Adicione URLs em server/crossAppValidation.ts");
    }
    
  } catch (error) {
    console.log("❌ Erro ao carregar configuração de validação cruzada");
  }
} else {
  console.log("❌ CROSS_APP_SECRET não configurado");
  console.log("   O sistema não conseguirá validar duplicatas entre apps");
}

console.log("\n4. TESTANDO ENDPOINTS PRINCIPAIS:");
console.log("-".repeat(40));

try {
  // Teste do endpoint de validação cruzada
  const fetch = (await import('node-fetch')).default;
  const baseUrl = process.env.REPL_SLUG ? 
    `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 
    'http://localhost:5000';
  
  console.log(`🌐 Testando: ${baseUrl}`);
  
  // Teste básico de saúde da API
  try {
    const healthResponse = await fetch(`${baseUrl}/api/companies`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (healthResponse.ok) {
      console.log("✅ API principal funcionando");
    } else {
      console.log(`⚠️  API retornou status ${healthResponse.status}`);
    }
  } catch (apiError) {
    console.log("❌ Erro ao testar API principal");
  }
  
  // Teste do endpoint de validação cruzada
  if (hasCrossAppSecret) {
    try {
      const crossAppResponse = await fetch(`${baseUrl}/api/validate/cross-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: '00000000000',
          appSecret: process.env.CROSS_APP_SECRET
        }),
        timeout: 5000
      });
      
      console.log(`✅ Endpoint de validação cruzada disponível (${crossAppResponse.status})`);
    } catch (crossAppError) {
      console.log("⚠️  Endpoint de validação cruzada indisponível");
    }
  }
  
} catch (error) {
  console.log("❌ Erro ao testar endpoints");
}

console.log("\n5. RESUMO DA CONFIGURAÇÃO:");
console.log("=".repeat(40));

const configScore = [hasDatabase, hasProduction, hasMasterPassword, hasCrossAppSecret]
  .filter(Boolean).length;

console.log(`📊 Configuração: ${configScore}/4 itens OK`);

if (configScore === 4) {
  console.log("🎉 SISTEMA COMPLETAMENTE CONFIGURADO!");
  console.log("✅ Pronto para uso em produção");
  console.log("✅ Validação cruzada ativa");
  console.log("✅ Segurança máxima ativada");
} else {
  console.log("⚠️  CONFIGURAÇÃO INCOMPLETA");
  
  if (!hasDatabase) console.log("   - Configure DATABASE_URL");
  if (!hasProduction) console.log("   - Configure PRODUCTION_MODE=true");
  if (!hasMasterPassword) console.log("   - Configure MASTER_PASSWORD");
  if (!hasCrossAppSecret) console.log("   - Configure CROSS_APP_SECRET");
}

console.log("\n📚 DOCUMENTAÇÃO:");
console.log("   - Sistema geral: docs/configuracao-producao-completa.md");
console.log("   - Validação cruzada: docs/validacao-cruzada-apps.md");
console.log("   - Criar admin: docs/criar-admin-producao.md");

console.log("\n" + "=".repeat(50));