#!/usr/bin/env tsx
/**
 * Script para configurar validação cruzada entre aplicativos
 * Este script ajuda a configurar o sistema anti-duplicatas
 */

console.log("=== CONFIGURAÇÃO DE VALIDAÇÃO CRUZADA ENTRE APPS ===\n");

console.log("Este sistema previne que usuários se cadastrem em múltiplos");
console.log("aplicativos remixados para ganhar comissões duplicadas.\n");

console.log("COMO CONFIGURAR:");
console.log("-".repeat(50));

console.log("\n1. ADICIONE O SECRET NAS VARIÁVEIS DO REPLIT:");
console.log("   Nome: CROSS_APP_SECRET");
console.log("   Valor: Uma senha forte compartilhada entre todos os apps");
console.log("   Exemplo: KongPix2025ValidacaoCruzada#Secret");

console.log("\n2. CONFIGURE AS URLs DOS OUTROS APLICATIVOS:");
console.log("   Edite o arquivo: server/crossAppValidation.ts");
console.log("   Adicione as URLs na constante CENTRAL_VALIDATION_APIS");
console.log("   Exemplo:");
console.log("   export const CENTRAL_VALIDATION_APIS = [");
console.log("     'https://app-principal.replit.app',");
console.log("     'https://app-parceiro1.replit.app',");
console.log("     'https://app-parceiro2.replit.app'");
console.log("   ];");

console.log("\n3. INTEGRAÇÃO AUTOMÁTICA:");
console.log("   A validação já está integrada em:");
console.log("   • Registro de novos usuários");
console.log("   • Criação de indicações");
console.log("   • Criação via admin/analista");

console.log("\n4. COMO FUNCIONA:");
console.log("   • Usuário tenta cadastrar CPF 123.456.789-00");
console.log("   • Sistema verifica no banco local");
console.log("   • Sistema consulta outros apps configurados");
console.log("   • Se encontrar duplicata, bloqueia o cadastro");
console.log("   • Mostra mensagem: 'CPF já cadastrado em outro app'");

console.log("\n5. SEGURANÇA:");
console.log("   • Apenas apps com o secret correto podem consultar");
console.log("   • Timeout de 5 segundos por consulta");
console.log("   • Se um app estiver offline, não bloqueia");

console.log("\n6. TESTE A CONFIGURAÇÃO:");
console.log("   Use curl para testar o endpoint:");
console.log("   curl -X POST https://seu-app.replit.app/api/validate/cross-app \\");
console.log("     -H 'Content-Type: application/json' \\");
console.log("     -d '{\"cpf\": \"12345678900\", \"appSecret\": \"seu-secret\"}'");

console.log("\n7. MONITORAMENTO:");
console.log("   • Veja tentativas bloqueadas em: Admin > Logs de Auditoria");
console.log("   • Filtrar por: 'validação cruzada'");

console.log("\n" + "=".repeat(50));
console.log("STATUS ATUAL:");

// Verificar se o secret está configurado
const hasSecret = !!process.env.CROSS_APP_SECRET;
console.log(`\nCROSS_APP_SECRET: ${hasSecret ? '✅ Configurado' : '❌ Não configurado'}`);

if (!hasSecret) {
  console.log("\n⚠️  AÇÃO NECESSÁRIA:");
  console.log("Configure o CROSS_APP_SECRET nas variáveis do Replit!");
  console.log("Sem isso, a validação cruzada não funcionará.");
} else {
  console.log("\n✅ Sistema pronto para validação cruzada!");
  console.log("Não esqueça de adicionar as URLs dos outros apps.");
}

console.log("\nPara mais detalhes, veja: docs/validacao-cruzada-apps.md");
console.log("=".repeat(50));