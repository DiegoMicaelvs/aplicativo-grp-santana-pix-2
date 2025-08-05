import { createClient } from '@neondatabase/serverless';

// Script para limpar o rate limiting de login
// Útil quando usuários legítimos são bloqueados

async function clearRateLimit() {
  console.log("=== Limpeza de Rate Limiting ===\n");
  
  console.log("NOTA: O rate limiting é armazenado em memória no servidor.");
  console.log("Para limpar o rate limiting, você precisa:");
  console.log("1. Reiniciar o servidor");
  console.log("2. Ou aguardar 15 minutos para o reset automático");
  console.log("\nO sistema permite 10 tentativas de login a cada 15 minutos por IP.");
  
  console.log("\n=== Recomendações ===");
  console.log("- Verifique se o usuário está digitando a senha corretamente");
  console.log("- Confirme que o email/username está em minúsculas");
  console.log("- Considere resetar a senha do usuário se necessário");
  console.log("- Verifique se o usuário não está desativado");
  
  process.exit(0);
}

clearRateLimit();