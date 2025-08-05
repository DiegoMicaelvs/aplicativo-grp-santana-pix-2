// Script para orientar sobre reset de tentativas de login
console.log("=== Reset de Tentativas de Login ===\n");

console.log("O sistema de rate limiting está configurado para:");
console.log("- Permitir 10 tentativas de login por IP");
console.log("- Bloquear por 15 minutos após exceder o limite");
console.log("- Reset automático após 15 minutos\n");

console.log("=== Possíveis Causas de 'Credenciais Inválidas' ===\n");

console.log("1. SENHA INCORRETA");
console.log("   - Verifique se o usuário está digitando a senha corretamente");
console.log("   - Senhas são case-sensitive (maiúsculas e minúsculas importam)");
console.log("   - Verifique espaços extras no início ou fim\n");

console.log("2. EMAIL/USERNAME INCORRETO");
console.log("   - O sistema converte automaticamente para minúsculas");
console.log("   - Remove espaços no início e fim");
console.log("   - Exemplo: 'USUARIO@Gmail.com ' → 'usuario@gmail.com'\n");

console.log("3. RATE LIMITING");
console.log("   - Após 10 tentativas falhas, o IP é bloqueado por 15 minutos");
console.log("   - Mensagem de erro será diferente: 'Muitas tentativas de login'\n");

console.log("4. CONTA DESATIVADA");
console.log("   - Verifique se o usuário está ativo no sistema");
console.log("   - Use o script diagnose-login-issues.ts para verificar\n");

console.log("=== Soluções Recomendadas ===\n");

console.log("1. Para resetar a senha de um usuário:");
console.log("   npm run script scripts/reset-user-password.ts\n");

console.log("2. Para diagnosticar problemas gerais:");
console.log("   npm run script scripts/diagnose-login-issues.ts\n");

console.log("3. Para limpar rate limiting:");
console.log("   - Reinicie o servidor");
console.log("   - Ou aguarde 15 minutos\n");

console.log("4. Verificar logs do servidor:");
console.log("   - Os logs mostram tentativas de login");
console.log("   - Procure por '[AUTH]' nos logs para detalhes\n");

process.exit(0);