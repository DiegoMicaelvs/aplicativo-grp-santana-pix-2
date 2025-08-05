import { db } from "../db";
import { users, referrals } from "@shared/schema.ts";
import { eq, sql, and, or } from "drizzle-orm";

async function fixTotalEarnings() {
  console.log("=== Corrigindo Total de Ganhos dos Promotores ===");
  
  try {
    // Buscar todos os promotores
    const promoters = await db.query.users.findMany({
      where: eq(users.role, 'promotor')
    });
    
    console.log(`Encontrados ${promoters.length} promotores`);
    
    for (const promoter of promoters) {
      // Calcular o total de comissões do promotor
      const promoterReferrals = await db.query.referrals.findMany({
        where: eq(referrals.promoterId, promoter.id)
      });
      
      let totalCommissions = 0;
      
      for (const referral of promoterReferrals) {
        if (referral.commissionPromoter) {
          totalCommissions += parseFloat(referral.commissionPromoter.toString());
        }
      }
      
      // Verificar se o totalEarnings está correto
      const currentTotalEarnings = parseFloat(promoter.totalEarnings?.toString() || '0');
      
      if (Math.abs(currentTotalEarnings - totalCommissions) > 0.01) {
        console.log(`\nPromotor: ${promoter.fullName} (${promoter.username})`);
        console.log(`Total de ganhos atual: R$ ${currentTotalEarnings.toFixed(2)}`);
        console.log(`Total de comissões calculado: R$ ${totalCommissions.toFixed(2)}`);
        console.log(`Diferença: R$ ${(totalCommissions - currentTotalEarnings).toFixed(2)}`);
        
        // Atualizar o totalEarnings para o valor correto
        await db.update(users)
          .set({ 
            totalEarnings: totalCommissions.toString(),
            updatedAt: new Date()
          })
          .where(eq(users.id, promoter.id));
        
        console.log("✓ Total de ganhos corrigido!");
      } else {
        console.log(`\n✓ Promotor ${promoter.fullName} já tem total de ganhos correto: R$ ${currentTotalEarnings.toFixed(2)}`);
      }
    }
    
    console.log("\n=== Correção concluída ===");
    
  } catch (error) {
    console.error("Erro ao corrigir total de ganhos:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixTotalEarnings();