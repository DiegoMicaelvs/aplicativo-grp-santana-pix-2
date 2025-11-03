import { db } from "../db";
import { cashFlow } from "../shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

async function fixDuplicateCashFlowEntries() {
  console.log("=== Script para Corrigir Registros Duplicados no Fluxo de Caixa ===\n");
  
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

    console.log("\n=== Limpeza de Duplicados ===\n");
    
    let totalDeleted = 0;
    
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
        await db.delete(cashFlow)
          .where(eq(cashFlow.id, entryToDelete.id));
        totalDeleted++;
      }
    }
    
    console.log(`\n✓ ${totalDeleted} registros duplicados foram removidos com sucesso!`);
    console.log("\nObservação: Após remover os duplicados, é recomendado recalcular os saldos do fluxo de caixa.");
    console.log("O saldo será recalculado automaticamente nas próximas transações.\n");
    
  } catch (error) {
    console.error("Erro ao corrigir registros duplicados:", error);
    throw error;
  }
}

fixDuplicateCashFlowEntries()
  .then(() => {
    console.log("\n✓ Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Erro ao executar script:", error);
    process.exit(1);
  });
