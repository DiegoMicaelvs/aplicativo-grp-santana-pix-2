import { db } from "../db";
import { 
  users, 
  referrals, 
  withdrawalRequests, 
  auditLog, 
  cashFlow,
  supportTickets,
  referralConversations,
  ticketResponses,
  salesLeads,
  salesActivities,
  salesReminders
} from "@shared/schema";
import { ne, eq } from "drizzle-orm";

async function cleanForProduction() {
  try {
    console.log("🧹 Iniciando limpeza para produção...");
    console.log("=====================================");
    
    // 1. Limpar saques
    console.log("\n1. Limpando saques...");
    const deletedWithdrawals = await db.delete(withdrawalRequests).returning();
    console.log(`   ✅ ${deletedWithdrawals.length} saques removidos`);
    
    // 2. Limpar indicações
    console.log("\n2. Limpando indicações...");
    const deletedReferrals = await db.delete(referrals).returning();
    console.log(`   ✅ ${deletedReferrals.length} indicações removidas`);
    
    // 3. Limpar audit log
    console.log("\n3. Limpando logs de auditoria...");
    const deletedAuditLogs = await db.delete(auditLog).returning();
    console.log(`   ✅ ${deletedAuditLogs.length} logs removidos`);
    
    // 4. Limpar cash flow
    console.log("\n4. Limpando fluxo de caixa...");
    const deletedCashFlow = await db.delete(cashFlow).returning();
    console.log(`   ✅ ${deletedCashFlow.length} entradas de fluxo removidas`);
    
    // 5. Limpar tickets de suporte e respostas
    console.log("\n5. Limpando tickets de suporte...");
    const deletedTicketResponses = await db.delete(ticketResponses).returning();
    console.log(`   ✅ ${deletedTicketResponses.length} respostas de tickets removidas`);
    const deletedTickets = await db.delete(supportTickets).returning();
    console.log(`   ✅ ${deletedTickets.length} tickets removidos`);
    
    // 6. Limpar conversas de indicações
    console.log("\n6. Limpando conversas de indicações...");
    const deletedConversations = await db.delete(referralConversations).returning();
    console.log(`   ✅ ${deletedConversations.length} conversas removidas`);
    
    // 7. Limpar dados de vendas
    console.log("\n7. Limpando dados de vendas...");
    const deletedReminders = await db.delete(salesReminders).returning();
    console.log(`   ✅ ${deletedReminders.length} lembretes removidos`);
    const deletedActivities = await db.delete(salesActivities).returning();
    console.log(`   ✅ ${deletedActivities.length} atividades removidas`);
    const deletedLeads = await db.delete(salesLeads).returning();
    console.log(`   ✅ ${deletedLeads.length} leads removidos`);
    
    // 8. Buscar todos os administradores antes de deletar
    console.log("\n8. Identificando administradores...");
    const admins = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.role, "admin")
    });
    console.log(`   ℹ️ ${admins.length} administradores encontrados:`);
    admins.forEach(admin => {
      console.log(`      - ${admin.username} (${admin.fullName})`);
    });
    
    // 9. Limpar todos os usuários exceto admins
    console.log("\n9. Limpando usuários não-admin...");
    const deletedUsers = await db.delete(users)
      .where(ne(users.role, "admin"))
      .returning();
    console.log(`   ✅ ${deletedUsers.length} usuários removidos`);
    
    // 10. Resetar saldos e ganhos dos admins
    console.log("\n10. Resetando saldos dos administradores...");
    const updatedAdmins = await db.update(users)
      .set({
        balance: "0.00",
        totalEarnings: "0.00"
      })
      .where(eq(users.role, "admin"))
      .returning();
    console.log(`   ✅ ${updatedAdmins.length} administradores resetados`);
    
    // 11. Resumo final
    console.log("\n=====================================");
    console.log("🎉 LIMPEZA CONCLUÍDA COM SUCESSO!");
    console.log("=====================================");
    console.log("\n📊 Resumo:");
    console.log(`   • Saques removidos: ${deletedWithdrawals.length}`);
    console.log(`   • Indicações removidas: ${deletedReferrals.length}`);
    console.log(`   • Logs removidos: ${deletedAuditLogs.length}`);
    console.log(`   • Fluxo de caixa limpo: ${deletedCashFlow.length} entradas`);
    console.log(`   • Tickets removidos: ${deletedTickets.length}`);
    console.log(`   • Respostas de tickets removidas: ${deletedTicketResponses.length}`);
    console.log(`   • Conversas removidas: ${deletedConversations.length}`);
    console.log(`   • Leads removidos: ${deletedLeads.length}`);
    console.log(`   • Atividades removidas: ${deletedActivities.length}`);
    console.log(`   • Lembretes removidos: ${deletedReminders.length}`);
    console.log(`   • Usuários removidos: ${deletedUsers.length}`);
    console.log(`   • Administradores mantidos: ${admins.length}`);
    
    console.log("\n✅ Sistema pronto para produção!");
    console.log("\n🔑 Administradores disponíveis:");
    admins.forEach(admin => {
      console.log(`   • ${admin.username}`);
    });
    
  } catch (error) {
    console.error("\n❌ Erro durante a limpeza:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Confirmar antes de executar
console.log("⚠️  ATENÇÃO: Esta operação irá:");
console.log("   • Remover TODOS os saques");
console.log("   • Remover TODAS as indicações");
console.log("   • Remover TODOS os usuários exceto administradores");
console.log("   • Limpar logs e fluxo de caixa");
console.log("");
console.log("Aguardando 5 segundos antes de iniciar...");
console.log("Pressione Ctrl+C para cancelar");

setTimeout(() => {
  cleanForProduction();
}, 5000);