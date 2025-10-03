import { db } from "../db";
import { withdrawalRequests, users } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function updatePaymentDates() {
  console.log("🔄 Atualizando datas de pagamento...");
  
  const paymentDates = [
    { userId: 45, date: new Date("2024-08-07T00:00:00") }, // Doracy Carneiro
    { userId: 53, date: new Date("2025-08-08T00:00:00") }, // Guilherme Pereira dos Santos
    { userId: 115, date: new Date("2025-08-08T00:00:00") }, // Rodrigo Ferreira de Sa
    { userId: 121, date: new Date("2025-08-15T00:00:00") }, // Aparecida de Sousa
    { userId: 123, date: new Date("2025-08-18T00:00:00") }, // Danilo Moura
    { userId: 151, date: new Date("2025-09-04T00:00:00") } // Jhonatan Araújo da Costa
  ];
  
  for (const payment of paymentDates) {
    try {
      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.id, payment.userId)
      });
      
      if (!user) {
        console.log(`⚠️  Usuário não encontrado: ID ${payment.userId}`);
        continue;
      }
      
      // Find paid withdrawal for this user
      const withdrawal = await db.query.withdrawalRequests.findFirst({
        where: and(
          eq(withdrawalRequests.userId, user.id),
          eq(withdrawalRequests.status, 'paid')
        ),
        orderBy: (withdrawalRequests, { desc }) => [desc(withdrawalRequests.requestedAt)]
      });
      
      if (!withdrawal) {
        console.log(`⚠️  Nenhum saque pago encontrado para: ${user.fullName}`);
        continue;
      }
      
      // Update paidAt
      await db.update(withdrawalRequests)
        .set({
          paidAt: payment.date
        })
        .where(eq(withdrawalRequests.id, withdrawal.id));
      
      console.log(`✅ ${user.fullName} - Saque #${withdrawal.id} atualizado para ${payment.date.toLocaleDateString('pt-BR')}`);
      
    } catch (error) {
      console.error(`❌ Erro ao processar ID ${payment.userId}:`, error);
    }
  }
  
  console.log("\n✨ Atualização concluída!");
}

updatePaymentDates()
  .then(() => {
    console.log("✅ Script finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script falhou:", error);
    process.exit(1);
  });
