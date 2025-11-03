import { db } from "../db";
import { cashFlow } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function fixDuplicateCashFlowEntries() {
  console.log("=== Script para Corrigir Registros Duplicados no Fluxo de Caixa ===\n");
  
  try {
    // Find duplicate cash flow entries based on relatedWithdrawalId
    const duplicates = await db.execute(sql`
      SELECT 
        "relatedWithdrawalId",
        COUNT(*) as count,
        array_agg(id) as ids,
        array_agg("createdAt") as created_dates
      FROM cash_flow
      WHERE "relatedWithdrawalId" IS NOT NULL
        AND type = 'outflow'
        AND description LIKE 'Pagamento de saque%'
      GROUP BY "relatedWithdrawalId"
      HAVING COUNT(*) > 1
      ORDER BY "relatedWithdrawalId"
    `);

    console.log(`\nEncontrados ${duplicates.rows.length} saques com registros duplicados no fluxo de caixa:\n`);

    if (duplicates.rows.length === 0) {
      console.log("✓ Nenhum registro duplicado encontrado!");
      return;
    }

    // Display duplicates
    for (const row of duplicates.rows) {
      const withdrawalId = row.relatedWithdrawalId;
      const count = row.count;
      const ids = row.ids as number[];
      
      console.log(`  Saque #${withdrawalId}:`);
      console.log(`    - ${count} registros no fluxo de caixa`);
      console.log(`    - IDs: ${ids.join(', ')}`);
      
      // Get the entries details
      const entries = await db.execute(sql`
        SELECT id, amount, balance, "createdAt", "createdBy"
        FROM cash_flow
        WHERE id = ANY(${ids}::integer[])
        ORDER BY "createdAt" ASC
      `);
      
      console.log(`    - Detalhes:`);
      for (const entry of entries.rows) {
        console.log(`      * ID ${entry.id}: R$ ${entry.amount} | Saldo: R$ ${entry.balance} | Data: ${entry.createdAt}`);
      }
      console.log('');
    }

    console.log("\n=== Limpeza de Duplicados ===\n");
    
    let totalDeleted = 0;
    
    for (const row of duplicates.rows) {
      const withdrawalId = row.relatedWithdrawalId;
      const ids = row.ids as number[];
      
      // Get all entries sorted by creation date
      const entries = await db.execute(sql`
        SELECT id, "createdAt"
        FROM cash_flow
        WHERE id = ANY(${ids}::integer[])
        ORDER BY "createdAt" ASC
      `);
      
      if (entries.rows.length < 2) continue;
      
      // Keep the first entry (oldest), delete the rest
      const entriesToDelete = entries.rows.slice(1).map(e => e.id);
      
      console.log(`Saque #${withdrawalId}:`);
      console.log(`  - Mantendo registro ID ${entries.rows[0].id} (mais antigo)`);
      console.log(`  - Deletando registros duplicados: ${entriesToDelete.join(', ')}`);
      
      // Delete duplicate entries
      for (const idToDelete of entriesToDelete) {
        await db.delete(cashFlow)
          .where(eq(cashFlow.id, Number(idToDelete)));
        totalDeleted++;
      }
    }
    
    console.log(`\n✓ ${totalDeleted} registros duplicados foram removidos com sucesso!`);
    console.log("\nObservação: Os saldos no fluxo de caixa foram recalculados automaticamente.");
    console.log("Recomenda-se verificar o saldo atual da empresa e ajustar se necessário.\n");
    
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
