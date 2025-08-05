import { db } from "../db";
import { withdrawalRequests, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function testMultipleWithdrawals() {
  console.log("=== Testando Múltiplos Saques ===");
  
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.id, 5)
  });
  
  console.log("\n1. Dados do usuário:");
  console.log(`   Nome: ${user?.fullName}`);
  console.log(`   Saldo: R$ ${user?.balance}`);
  
  // Buscar saques pendentes/aprovados
  const withdrawals = await db.query.withdrawalRequests.findMany({
    where: eq(withdrawalRequests.userId, 5),
    orderBy: (withdrawalRequests, { desc }) => [desc(withdrawalRequests.requestedAt)]
  });
  
  const pendingOrApproved = withdrawals.filter(w => 
    w.status === 'pending' || w.status === 'approved'
  );
  
  console.log("\n2. Saques pendentes/aprovados:");
  pendingOrApproved.forEach(w => {
    console.log(`   - Status: ${w.status}, Valor: R$ ${w.amount}`);
  });
  
  console.log("\n3. Regra atual:");
  console.log("   - Permitido: Múltiplos saques com valores DIFERENTES");
  console.log("   - Bloqueado: Saques com o MESMO valor de um saque pendente/aprovado");
  
  console.log("\n4. Exemplos:");
  if (pendingOrApproved.length > 0) {
    const approvedAmount = parseFloat(pendingOrApproved[0].amount);
    console.log(`   - Saque aprovado: R$ ${approvedAmount.toFixed(2)}`);
    console.log(`   - Novo saque R$ ${approvedAmount.toFixed(2)} - BLOQUEADO ❌`);
    console.log(`   - Novo saque R$ ${(approvedAmount + 5).toFixed(2)} - PERMITIDO ✅`);
    console.log(`   - Novo saque R$ ${(approvedAmount - 1).toFixed(2)} - PERMITIDO ✅`);
  }
  
  process.exit(0);
}

testMultipleWithdrawals().catch(console.error);