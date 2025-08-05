import { db } from "../db";
import { users, referrals } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function fixTotalEarnings() {
  console.log("=== Corrigindo Total de Ganhos ===\n");
  
  // Buscar todos os usuários
  const allUsers = await db.query.users.findMany();
  
  for (const user of allUsers) {
    // Calcular o total correto baseado apenas em comissões PAGAS
    const userReferrals = await db.query.referrals.findMany({
      where: eq(referrals.userId, user.id)
    });
    
    const promoterReferrals = await db.query.referrals.findMany({
      where: eq(referrals.promoterId, user.id)
    });
    
    // Somar apenas comissões de indicações com status "paid"
    const paidCommissionIndicator = userReferrals
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.commissionIndicator || '0'), 0);
    
    const paidCommissionPromoter = promoterReferrals
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.commissionPromoter || '0'), 0);
    
    const totalPaidCommissions = paidCommissionIndicator + paidCommissionPromoter;
    
    console.log(`\nUsuário: ${user.fullName} (ID: ${user.id})`);
    console.log(`- Total atual (incorreto): R$ ${user.totalEarnings}`);
    console.log(`- Comissões pagas como indicador: R$ ${paidCommissionIndicator.toFixed(2)}`);
    console.log(`- Comissões pagas como promotor: R$ ${paidCommissionPromoter.toFixed(2)}`);
    console.log(`- Total correto: R$ ${totalPaidCommissions.toFixed(2)}`);
    
    // Atualizar apenas se houver diferença
    if (parseFloat(user.totalEarnings) !== totalPaidCommissions) {
      await db.update(users)
        .set({ totalEarnings: totalPaidCommissions.toFixed(2) })
        .where(eq(users.id, user.id));
      console.log(`✓ Atualizado!`);
    } else {
      console.log(`✓ Já está correto`);
    }
  }
  
  console.log("\n=== Correção concluída ===");
  process.exit(0);
}

fixTotalEarnings().catch(console.error);