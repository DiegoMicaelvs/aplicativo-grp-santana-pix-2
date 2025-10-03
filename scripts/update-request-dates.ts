import { db } from "../db";
import { withdrawalRequests } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateRequestDates() {
  console.log("🔄 Atualizando datas de solicitação...");
  
  const requestDates = [
    { userId: 45, date: new Date("2024-08-07T00:00:00") }, // Doracy Carneiro
    { userId: 53, date: new Date("2025-08-08T00:00:00") }, // Guilherme Pereira dos Santos
    { userId: 115, date: new Date("2025-08-08T00:00:00") }, // Rodrigo Ferreira de Sa
    { userId: 121, date: new Date("2025-08-15T00:00:00") }, // Aparecida de Sousa
    { userId: 123, date: new Date("2025-08-18T00:00:00") }, // Danilo Moura
    { userId: 151, date: new Date("2025-09-04T00:00:00") } // Jhonatan Araújo da Costa
  ];
  
  for (const request of requestDates) {
    try {
      // Find user's paid withdrawal
      const withdrawal = await db.query.withdrawalRequests.findFirst({
        where: eq(withdrawalRequests.userId, request.userId),
        orderBy: (withdrawalRequests, { desc }) => [desc(withdrawalRequests.requestedAt)]
      });
      
      if (!withdrawal) {
        console.log(`⚠️  Nenhum saque encontrado para userId: ${request.userId}`);
        continue;
      }
      
      // Update requestedAt
      await db.update(withdrawalRequests)
        .set({
          requestedAt: request.date
        })
        .where(eq(withdrawalRequests.id, withdrawal.id));
      
      console.log(`✅ Saque #${withdrawal.id} - Data de solicitação atualizada para ${request.date.toLocaleDateString('pt-BR')}`);
      
    } catch (error) {
      console.error(`❌ Erro ao processar userId ${request.userId}:`, error);
    }
  }
  
  console.log("\n✨ Atualização concluída!");
}

updateRequestDates()
  .then(() => {
    console.log("✅ Script finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script falhou:", error);
    process.exit(1);
  });
