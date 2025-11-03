import { db } from "../db";
import { cashFlow } from "../shared/schema";
import { eq, asc } from "drizzle-orm";

async function recalculateCashFlowBalances() {
  console.log("=== Recalcular Todos os Saldos do Fluxo de Caixa ===\n");
  
  try {
    await db.transaction(async (tx) => {
      // Get all cash flow entries in chronological order
      const allEntries = await tx.query.cashFlow.findMany({
        orderBy: (cashFlow, { asc }) => [asc(cashFlow.createdAt), asc(cashFlow.id)]
      });
      
      console.log(`Total de ${allEntries.length} registros no fluxo de caixa.\n`);
      console.log("Recalculando saldos...\n");
      
      let runningBalance = 0;
      let updatedCount = 0;
      let errors = 0;
      
      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        const amount = parseFloat(entry.amount);
        
        // Calculate expected balance
        const expectedBalance = entry.type === 'inflow' 
          ? runningBalance + amount 
          : runningBalance - amount;
        
        const currentBalance = parseFloat(entry.balance);
        const difference = Math.abs(expectedBalance - currentBalance);
        
        // Update balance if it's different (tolerance of 0.01)
        if (difference > 0.01) {
          await tx.update(cashFlow)
            .set({ balance: expectedBalance.toFixed(2) })
            .where(eq(cashFlow.id, entry.id));
          
          console.log(`  ${i + 1}. ID ${entry.id} [${entry.type === 'inflow' ? 'ENTRADA' : 'SAÍDA'}]:`);
          console.log(`     Descrição: ${entry.description.substring(0, 50)}${entry.description.length > 50 ? '...' : ''}`);
          console.log(`     Valor: R$ ${amount.toFixed(2)}`);
          console.log(`     Saldo anterior (INCORRETO): R$ ${currentBalance.toFixed(2)}`);
          console.log(`     Saldo novo (CORRETO): R$ ${expectedBalance.toFixed(2)}`);
          console.log(`     Diferença: R$ ${difference.toFixed(2)}\n`);
          updatedCount++;
        }
        
        runningBalance = expectedBalance;
      }
      
      console.log("\n" + "=".repeat(60));
      console.log(`✓ Recálculo concluído!`);
      console.log(`  - Total de registros: ${allEntries.length}`);
      console.log(`  - Saldos atualizados: ${updatedCount}`);
      console.log(`  - Saldos corretos: ${allEntries.length - updatedCount}`);
      console.log(`  - Saldo final do caixa: R$ ${runningBalance.toFixed(2)}`);
      console.log("=".repeat(60) + "\n");
      
      if (updatedCount === 0) {
        console.log("✓ Todos os saldos já estavam corretos!\n");
      } else {
        console.log(`✓ ${updatedCount} saldos foram corrigidos com sucesso!\n`);
      }
    });
    
  } catch (error) {
    console.error("Erro ao recalcular saldos:", error);
    throw error;
  }
}

recalculateCashFlowBalances()
  .then(() => {
    console.log("✓ Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Erro ao executar script:", error);
    process.exit(1);
  });
