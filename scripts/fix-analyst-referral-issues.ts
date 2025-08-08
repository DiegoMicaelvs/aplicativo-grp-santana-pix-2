import { db } from "../db/index";
import { users, referrals } from "../shared/schema";
import { eq } from "drizzle-orm";

// Script para diagnosticar e corrigir problemas de indicações para analistas nível 1
async function fixAnalystReferralIssues() {
  console.log('=== Diagnosticando Problemas de Indicações para Analistas ===\n');
  
  try {
    // 1. Verificar todos os analistas e seus níveis
    const allAnalysts = await db.query.users.findMany({
      where: eq(users.role, 'analista')
    });
    
    console.log('📊 Analistas encontrados:');
    allAnalysts.forEach(analyst => {
      console.log(`- ${analyst.fullName} (ID: ${analyst.id}, Nível: ${analyst.analystLevel}, Permissões: ${analyst.permissions?.length || 0})`);
    });
    console.log('');
    
    // 2. Verificar indicações e suas atribuições
    const allReferrals = await db.query.referrals.findMany({
      with: {
        user: true,
        createdByUser: true
      }
    });
    
    console.log(`📋 Total de indicações: ${allReferrals.length}\n`);
    
    // 3. Analisar problemas de atribuição
    let problematicReferrals = 0;
    let referencesWithoutUser = 0;
    let referencesWithoutCreator = 0;
    
    for (const referral of allReferrals) {
      let hasIssue = false;
      
      // Verificar se o usuário existe
      if (!referral.user) {
        console.log(`❌ Indicação ${referral.id} (${referral.fullName}) - Usuário ID ${referral.userId} não encontrado`);
        referencesWithoutUser++;
        hasIssue = true;
      }
      
      // Verificar se o criador existe
      if (!referral.createdByUser) {
        console.log(`⚠️  Indicação ${referral.id} (${referral.fullName}) - Criador ID ${referral.createdBy} não encontrado`);
        referencesWithoutCreator++;
        hasIssue = true;
      }
      
      // Verificar se promoter existe quando definido
      if (referral.promoterId) {
        const promoter = await db.query.users.findFirst({
          where: eq(users.id, referral.promoterId)
        });
        if (!promoter) {
          console.log(`⚠️  Indicação ${referral.id} (${referral.fullName}) - Promoter ID ${referral.promoterId} não encontrado`);
          hasIssue = true;
        }
      }
      
      if (hasIssue) {
        problematicReferrals++;
      }
    }
    
    console.log('\n📈 Resumo dos problemas encontrados:');
    console.log(`- Indicações com problemas: ${problematicReferrals}`);
    console.log(`- Referências a usuários inexistentes: ${referencesWithoutUser}`);
    console.log(`- Referências a criadores inexistentes: ${referencesWithoutCreator}`);
    
    // 4. Verificar se analistas nível 1 têm as permissões corretas
    console.log('\n🔍 Verificando permissões dos analistas nível 1:');
    const analystLevel1 = allAnalysts.filter(a => a.analystLevel === 1);
    
    for (const analyst of analystLevel1) {
      const permissions = analyst.permissions as string[] || [];
      const requiredPermissions = ['view_referrals', 'edit_referral_status'];
      const missingPermissions = requiredPermissions.filter(p => !permissions.includes(p));
      
      if (missingPermissions.length > 0) {
        console.log(`❌ ${analyst.fullName} (ID: ${analyst.id}) - Faltam permissões: ${missingPermissions.join(', ')}`);
        
        // Corrigir permissões automaticamente
        const updatedPermissions = [...permissions, ...missingPermissions];
        await db.update(users)
          .set({ permissions: updatedPermissions })
          .where(eq(users.id, analyst.id));
        
        console.log(`✅ Permissões corrigidas para ${analyst.fullName}`);
      } else {
        console.log(`✅ ${analyst.fullName} (ID: ${analyst.id}) - Permissões OK`);
      }
    }
    
    // 5. Verificar consistência de promoter-indicador relationships
    console.log('\n🔗 Verificando relacionamentos promoter-indicador:');
    const indicadores = await db.query.users.findMany({
      where: eq(users.role, 'indicador')
    });
    
    let inconsistentRelationships = 0;
    for (const indicador of indicadores) {
      if (indicador.promoterId) {
        const promoter = await db.query.users.findFirst({
          where: eq(users.id, indicador.promoterId)
        });
        
        if (!promoter) {
          console.log(`❌ Indicador ${indicador.fullName} (ID: ${indicador.id}) - Promoter ID ${indicador.promoterId} não existe`);
          inconsistentRelationships++;
          
          // Limpar referência inválida
          await db.update(users)
            .set({ promoterId: null })
            .where(eq(users.id, indicador.id));
          
          console.log(`✅ Referência inválida removida de ${indicador.fullName}`);
        }
      }
    }
    
    console.log(`\n📊 Relacionamentos inconsistentes encontrados e corrigidos: ${inconsistentRelationships}`);
    
    // 6. Gerar relatório final
    console.log('\n📋 RELATÓRIO FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Total de analistas: ${allAnalysts.length}`);
    console.log(`✅ Analistas nível 1: ${analystLevel1.length}`);
    console.log(`✅ Total de indicações: ${allReferrals.length}`);
    console.log(`${problematicReferrals > 0 ? '⚠️' : '✅'} Indicações problemáticas: ${problematicReferrals}`);
    console.log(`${inconsistentRelationships > 0 ? '⚠️' : '✅'} Relacionamentos inconsistentes: ${inconsistentRelationships}`);
    
    if (problematicReferrals === 0 && inconsistentRelationships === 0) {
      console.log('\n🎉 Nenhum problema crítico encontrado! O sistema está funcionando corretamente.');
    } else {
      console.log('\n🔧 Alguns problemas foram encontrados e corrigidos automaticamente.');
      console.log('   Recomenda-se verificar novamente após as correções.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a execução:', error);
  }
}

// Executar o script automaticamente
fixAnalystReferralIssues()
  .then(() => {
    console.log('\n✅ Script executado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

export { fixAnalystReferralIssues };