import { db } from "../db";
import { withdrawalRequests, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function testWithdrawals() {
  console.log("=== Testando Saques do Usuário 5 ===");
  
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.id, 5)
  });
  
  console.log("\n1. Dados do usuário:");
  console.log(`   ID: ${user?.id}`);
  console.log(`   Nome: ${user?.fullName}`);
  console.log(`   Saldo: R$ ${user?.balance}`);
  console.log(`   Total Ganhos: R$ ${user?.totalEarnings}`);
  
  // Buscar saques
  const withdrawals = await db.query.withdrawalRequests.findMany({
    where: eq(withdrawalRequests.userId, 5),
    orderBy: (withdrawalRequests, { desc }) => [desc(withdrawalRequests.requestedAt)]
  });
  
  console.log("\n2. Saques encontrados:", withdrawals.length);
  
  withdrawals.forEach((w, index) => {
    console.log(`\n   Saque ${index + 1}:`);
    console.log(`   - ID: ${w.id}`);
    console.log(`   - Status: ${w.status}`);
    console.log(`   - Valor: R$ ${w.amount}`);
    console.log(`   - Data: ${w.requestedAt}`);
    console.log(`   - Processado: ${w.processedAt || 'Não'}`);
  });
  
  // Verificar saques pendentes/aprovados
  const pendingWithdrawals = withdrawals.filter(w => 
    w.status === 'pending' || w.status === 'approved'
  );
  
  console.log("\n3. Saques pendentes/aprovados:", pendingWithdrawals.length);
  pendingWithdrawals.forEach(w => {
    console.log(`   - ID ${w.id}: ${w.status} - R$ ${w.amount}`);
  });
  
  process.exit(0);
}

testWithdrawals().catch(console.error);