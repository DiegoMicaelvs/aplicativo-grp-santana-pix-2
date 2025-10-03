import { db } from "../db";
import { withdrawalRequests, cashFlow } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function backfillPaidAt() {
  console.log("🔄 Iniciando backfill de paidAt...");
  
  try {
    // Get all paid withdrawals that don't have paidAt set
    const paidWithdrawals = await db.query.withdrawalRequests.findMany({
      where: and(
        eq(withdrawalRequests.status, 'paid')
      )
    });
    
    console.log(`📊 Encontrados ${paidWithdrawals.length} saques pagos`);
    
    let updated = 0;
    
    for (const withdrawal of paidWithdrawals) {
      // Find corresponding cash flow entry
      const cashFlowEntry = await db.query.cashFlow.findFirst({
        where: and(
          eq(cashFlow.relatedWithdrawalId, withdrawal.id),
          eq(cashFlow.type, 'outflow')
        ),
        orderBy: (cashFlow, { desc }) => [desc(cashFlow.createdAt)]
      });
      
      if (cashFlowEntry) {
        // Update paidAt with cash flow creation date (real payment date)
        await db.update(withdrawalRequests)
          .set({
            paidAt: new Date(cashFlowEntry.createdAt)
          })
          .where(eq(withdrawalRequests.id, withdrawal.id));
        
        console.log(`✅ Saque #${withdrawal.id} atualizado com data de pagamento: ${cashFlowEntry.createdAt}`);
        updated++;
      } else {
        // If no cash flow entry, use processedAt as fallback (for old paid withdrawals)
        if (withdrawal.processedAt) {
          await db.update(withdrawalRequests)
            .set({
              paidAt: new Date(withdrawal.processedAt)
            })
            .where(eq(withdrawalRequests.id, withdrawal.id));
          
          console.log(`✅ Saque #${withdrawal.id} atualizado com processedAt (fallback): ${withdrawal.processedAt}`);
          updated++;
        } else {
          console.log(`⚠️  Saque #${withdrawal.id} não tem data de processamento`);
        }
      }
    }
    
    console.log(`\n✨ Backfill concluído! ${updated} saques atualizados.`);
  } catch (error) {
    console.error("❌ Erro no backfill:", error);
    throw error;
  }
}

backfillPaidAt()
  .then(() => {
    console.log("✅ Script finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script falhou:", error);
    process.exit(1);
  });
