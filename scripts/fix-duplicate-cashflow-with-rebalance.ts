import { db } from "../db";
import { cashFlow } from "../shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";

async function fixDuplicateCashFlowEntriesWithRebalance() {
  console.log("=== Script para Corrigir Registros Duplicados e Recalcular Saldos ===\n");
  
  try {
    // Find all cash flow entries related to withdrawals
    const allEntries = await db.query.cashFlow.findMany({
      where: and(
        sql`${cashFlow.relatedWithdrawalId} IS NOT NULL`,
        eq(cashFlow.type, 'outflow'),
        sql`${cashFlow.description} LIKE 'Pagamento de saque%'`
      ),
      orderBy: (cashFlow, { asc }) => [asc(cashFlow.relatedWithdrawalId), asc(cashFlow.createdAt)]
    });

    // Group by withdrawal ID
    const groupedByWithdrawal = new Map<number, typeof allEntries>();
    for (const entry of allEntries) {
      if (!entry.relatedWithdrawalId) continue;
      
      if (!groupedByWithdrawal.has(entry.relatedWithdrawalId)) {
        groupedByWithdrawal.set(entry.relatedWithdrawalId, []);
      }
      groupedByWithdrawal.get(entry.relatedWithdrawalId)!.push(entry);
    }

    // Find duplicates
    const duplicates = Array.from(groupedByWithdrawal.entries())
      .filter(([_, entries]) => entries.length > 1);

    console.log(`\nEncontrados ${duplicates.length} saques com registros duplicados no fluxo de caixa:\n`);

    if (duplicates.length === 0) {
      console.log("✓ Nenhum registro duplicado encontrado!");
      return;
    }

    // Display duplicates
    for (const [withdrawalId, entries] of duplicates) {
      console.log(`  Saque #${withdrawalId}:`);
      console.log(`    - ${entries.length} registros no fluxo de caixa`);
      console.log(`    - IDs: ${entries.map(e => e.id).join(', ')}`);
      console.log(`    - Detalhes:`);
      for (const entry of entries) {
        console.log(`      * ID ${entry.id}: R$ ${entry.amount} | Saldo: R$ ${entry.balance} | Data: ${entry.createdAt}`);
      }
      console.log('');
    }

    console.log("\n=== Limpeza de Duplicados e Recálculo de Saldos ===\n");
    
    // Execute in transaction
    await db.transaction(async (tx) => {
      let totalDeleted = 0;
      
      // Step 1: Delete duplicates
      for (const [withdrawalId, entries] of duplicates) {
        if (entries.length < 2) continue;
        
        // Keep the first entry (oldest), delete the rest
        const entriesToKeep = entries[0];
        const entriesToDelete = entries.slice(1);
        
        console.log(`Saque #${withdrawalId}:`);
        console.log(`  - Mantendo registro ID ${entriesToKeep.id} (mais antigo)`);
        console.log(`  - Deletando registros duplicados: ${entriesToDelete.map(e => e.id).join(', ')}`);
        
        // Delete duplicate entries
        for (const entryToDelete of entriesToDelete) {
          await tx.delete(cashFlow)
            .where(eq(cashFlow.id, entryToDelete.id));
          totalDeleted++;
        }
      }
      
      console.log(`\n✓ ${totalDeleted} registros duplicados foram removidos.`);
      console.log("\n=== Recalculando Saldos ===\n");
      
      // Step 2: Recalculate all balances from the beginning
      const allCashFlowEntries = await tx.query.cashFlow.findMany({
        orderBy: (cashFlow, { asc }) => [asc(cashFlow.createdAt), asc(cashFlow.id)]
      });
      
      let runningBalance = 0;
      let updatedCount = 0;
      
      for (const entry of allCashFlowEntries) {
        const amount = parseFloat(entry.amount);
        const expectedBalance = entry.type === 'inflow' 
          ? runningBalance + amount 
          : runningBalance - amount;
        
        const currentBalance = parseFloat(entry.balance);
        
        // Update balance if it's different
        if (Math.abs(expectedBalance - currentBalance) > 0.01) {
          await tx.update(cashFlow)
            .set({ balance: expectedBalance.toString() })
            .where(eq(cashFlow.id, entry.id));
          
          console.log(`  - Atualizado ID ${entry.id}: R$ ${currentBalance.toFixed(2)} → R$ ${expectedBalance.toFixed(2)}`);
          updatedCount++;
        }
        
        runningBalance = expectedBalance;
      }
      
      console.log(`\n✓ ${updatedCount} saldos foram recalculados.`);
      console.log(`✓ Saldo final do caixa: R$ ${runningBalance.toFixed(2)}\n`);
    });
    
    console.log("✓ Todos os registros duplicados foram removidos e saldos recalculados com sucesso!\n");
    
  } catch (error) {
    console.error("Erro ao corrigir registros duplicados:", error);
    throw error;
  }
}

fixDuplicateCashFlowEntriesWithRebalance()
  .then(() => {
    console.log("\n✓ Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Erro ao executar script:", error);
    process.exit(1);
  });
