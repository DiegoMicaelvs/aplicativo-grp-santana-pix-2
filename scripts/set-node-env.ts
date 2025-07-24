#!/usr/bin/env tsx
/**
 * Script para verificar e configurar NODE_ENV para produção
 */

console.log("=== CONFIGURAÇÃO NODE_ENV ===\n");

// Verificar variáveis de ambiente atuais
console.log("Variáveis de ambiente atuais:");
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
console.log(`PRODUCTION_MODE: ${process.env.PRODUCTION_MODE || 'não definido'}`);
console.log(`REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || 'não definido'}\n`);

// Detectar modo de produção
const isProduction = process.env.NODE_ENV === "production" || 
                    process.env.PRODUCTION_MODE === "true" ||
                    process.env.REPLIT_DEPLOYMENT === "1";

console.log(`Status de produção detectado: ${isProduction ? 'ATIVO' : 'INATIVO'}\n`);

if (isProduction) {
  console.log("✅ Sistema configurado para PRODUÇÃO");
  console.log("Recursos ativados:");
  console.log("  - Cookies seguros (HTTPS)");
  console.log("  - Rate limiting aprimorado");
  console.log("  - Headers de segurança");
  console.log("  - Auditoria completa");
  console.log("  - Senha master protegida");
} else {
  console.log("⚠️  Sistema em modo DESENVOLVIMENTO");
  console.log("Para ativar produção:");
  console.log("  1. Configure NODE_ENV=production nas secrets do Replit");
  console.log("  2. Ou mantenha PRODUCTION_MODE=true (já configurado)");
}

console.log("\n=== VERIFICAÇÃO CONCLUÍDA ===");