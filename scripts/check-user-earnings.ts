import { db } from "../db";
import { users, referrals, withdrawalRequests } from "@shared/schema.ts";
import { eq, sql, and, or } from "drizzle-orm";

async function checkUserEarnings() {
  console.log("=== Verificando Ganhos do Usuário ===");
  
  try {
    // Buscar o promotor
    const promoter = await db.query.users.findFirst({
      where: eq(users.username, 'promotordo@gmail.com')
    });
    
    if (!promoter) {
      console.log("Promotor não encontrado");
      return;
    }
    
    console.log(`\nPromotor: ${promoter.fullName} (ID: ${promoter.id})`);
    console.log(`Saldo atual: R$ ${promoter.balance}`);
    console.log(`Total ganhos (campo DB): R$ ${promoter.totalEarnings}`);
    
    // Buscar todas as indicações do promotor
    console.log("\n=== Indicações como Indicador ===");
    const userReferrals = await db.query.referrals.findMany({
      where: eq(referrals.userId, promoter.id)
    });
    
    let totalFromOwnReferrals = 0;
    for (const ref of userReferrals) {
      console.log(`- ID ${ref.id}: Status=${ref.status}, Comissão=${ref.commissionIndicator || 0}`);
      if (ref.status === 'paid' && ref.commissionIndicator) {
        totalFromOwnReferrals += parseFloat(ref.commissionIndicator.toString());
      }
    }
    
    // Buscar indicações da equipe (onde ele é o promotor)
    console.log("\n=== Indicações da Equipe (como Promotor) ===");
    const teamReferrals = await db.query.referrals.findMany({
      where: eq(referrals.promoterId, promoter.id)
    });
    
    let totalFromTeam = 0;
    for (const ref of teamReferrals) {
      console.log(`- ID ${ref.id}: Status=${ref.status}, Comissão Promotor=${ref.commissionPromoter || 0}`);
      if (ref.status === 'paid' && ref.commissionPromoter) {
        totalFromTeam += parseFloat(ref.commissionPromoter.toString());
      }
    }
    
    // Verificar saques
    console.log("\n=== Histórico de Saques ===");
    const withdrawals = await db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.userId, promoter.id)
    });
    
    let totalWithdrawn = 0;
    for (const w of withdrawals) {
      console.log(`- ID ${w.id}: R$ ${w.amount}, Status=${w.status}`);
      if (w.status === 'paid') {
        totalWithdrawn += parseFloat(w.amount.toString());
      }
    }
    
    console.log("\n=== Resumo ===");
    console.log(`Total de comissões próprias (status=paid): R$ ${totalFromOwnReferrals.toFixed(2)}`);
    console.log(`Total de comissões como promotor (status=paid): R$ ${totalFromTeam.toFixed(2)}`);
    console.log(`Total geral de comissões (paid): R$ ${(totalFromOwnReferrals + totalFromTeam).toFixed(2)}`);
    console.log(`Total sacado: R$ ${totalWithdrawn.toFixed(2)}`);
    console.log(`\nSaldo esperado: R$ ${(totalFromOwnReferrals + totalFromTeam - totalWithdrawn).toFixed(2)}`);
    
  } catch (error) {
    console.error("Erro ao verificar ganhos:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkUserEarnings();
