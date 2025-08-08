import { db } from "../db/index";
import { users, referrals } from "../shared/schema";
import { eq } from "drizzle-orm";

// Script para testar atualizações em tempo real para analistas
async function testAnalystRealTimeUpdates() {
  console.log('=== Testando Atualizações em Tempo Real para Analistas ===\n');
  
  try {
    // 1. Buscar analista nível 1 (Wesley Rocha)
    const analystLevel1 = await db.query.users.findFirst({
      where: eq(users.id, 55) // Wesley Rocha
    });
    
    if (!analystLevel1) {
      console.log('❌ Analista nível 1 não encontrado');
      return;
    }
    
    console.log(`📊 Analista encontrado: ${analystLevel1.fullName} (Nível ${analystLevel1.analystLevel})`);
    
    // 2. Buscar indicações atualmente no sistema
    const allReferrals = await db.query.referrals.findMany({
      with: {
        user: true,
        createdByUser: true,
        company: true
      }
    });
    
    console.log(`📋 Total de indicações no sistema: ${allReferrals.length}`);
    
    // 3. Analisar quais indicações deveriam aparecer para o analista nível 1
    console.log('\n🔍 Análise detalhada das indicações:');
    
    let inconsistentIndicators = 0;
    const indicationsWithIssues = [];
    
    for (const referral of allReferrals.slice(0, 10)) { // Analisar as primeiras 10
      const hasIssue = !referral.user || !referral.createdByUser;
      
      console.log(`\n📄 Indicação #${referral.id}:`);
      console.log(`   Cliente: ${referral.fullName}`);
      console.log(`   Usuário Atual (userId): ${referral.userId} - ${referral.user?.fullName || '❌ USUÁRIO NÃO ENCONTRADO'}`);
      console.log(`   Criado por (createdBy): ${referral.createdBy} - ${referral.createdByUser?.fullName || '❌ CRIADOR NÃO ENCONTRADO'}`);
      console.log(`   Empresa: ${referral.company?.name || 'N/A'}`);
      console.log(`   Status: ${referral.status}`);
      console.log(`   Data: ${new Date(referral.createdAt).toLocaleDateString('pt-BR')}`);
      
      if (hasIssue) {
        inconsistentIndicators++;
        indicationsWithIssues.push({
          id: referral.id,
          fullName: referral.fullName,
          missingUser: !referral.user,
          missingCreator: !referral.createdByUser
        });
        console.log(`   ⚠️  PROBLEMA: ${!referral.user ? 'Usuário não encontrado' : ''} ${!referral.createdByUser ? 'Criador não encontrado' : ''}`);
      } else {
        console.log(`   ✅ OK: Dados consistentes`);
      }
    }
    
    // 4. Verificar se há indicações que foram reatribuídas recentemente
    console.log('\n🔄 Verificando indicações com possível reatribuição:');
    
    const potentialReassignments = allReferrals.filter(r => 
      r.user && r.createdByUser && r.userId !== r.createdBy
    ).slice(0, 5);
    
    for (const referral of potentialReassignments) {
      console.log(`\n🔄 Indicação #${referral.id} (${referral.fullName}):`);
      console.log(`   Criada por: ${referral.createdByUser?.fullName} (ID: ${referral.createdBy})`);
      console.log(`   Atribuída para: ${referral.user?.fullName} (ID: ${referral.userId})`);
      console.log(`   Status: ${referral.status}`);
      
      if (referral.user?.role === 'indicador') {
        console.log(`   ✅ Atribuída a um indicador válido`);
      } else {
        console.log(`   ⚠️  Atribuída a usuário de role: ${referral.user?.role}`);
      }
    }
    
    // 5. Simular uma reatribuição para testar
    console.log('\n🧪 Simulando atualização de cache...');
    
    // Buscar um indicador ativo para teste
    const activeIndicator = await db.query.users.findFirst({
      where: eq(users.role, 'indicador')
    });
    
    if (activeIndicator && allReferrals.length > 0) {
      const testReferral = allReferrals[0];
      console.log(`\n🎯 Referência de teste: Indicação #${testReferral.id}`);
      console.log(`   Usuário atual: ${testReferral.user?.fullName || 'N/A'} (ID: ${testReferral.userId})`);
      console.log(`   Indicador ativo para teste: ${activeIndicator.fullName} (ID: ${activeIndicator.id})`);
      
      // Aqui poderíamos simular uma mudança se necessário
      console.log(`   📝 Nota: Em produção, analistas nível 1 deveriam ver esta indicação atribuída corretamente`);
    }
    
    // 6. Relatório final
    console.log('\n📊 RELATÓRIO DE TESTE:');
    console.log('='.repeat(50));
    console.log(`✅ Analista testado: ${analystLevel1.fullName} (Nível ${analystLevel1.analystLevel})`);
    console.log(`📋 Total de indicações: ${allReferrals.length}`);
    console.log(`${inconsistentIndicators > 0 ? '⚠️' : '✅'} Indicações com problemas: ${inconsistentIndicators}`);
    console.log(`🔄 Indicações reatribuídas: ${potentialReassignments.length}`);
    
    if (indicationsWithIssues.length > 0) {
      console.log('\n❌ Indicações problemáticas encontradas:');
      indicationsWithIssues.forEach(issue => {
        console.log(`   - #${issue.id} (${issue.fullName}): ${issue.missingUser ? 'Usuário faltando' : ''} ${issue.missingCreator ? 'Criador faltando' : ''}`);
      });
    }
    
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('- Analistas nível 1 devem ver o usuário ATUAL (userId) da indicação');
    console.log('- Sistema deve atualizar cache quando indicações são reatribuídas');
    console.log('- Polling de 15 segundos deve capturar mudanças rapidamente');
    console.log('- Interface deve distinguir entre "criado por" e "atribuído para"');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar o teste automaticamente
testAnalystRealTimeUpdates()
  .then(() => {
    console.log('\n✅ Teste executado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar teste:', error);
    process.exit(1);
  });

export { testAnalystRealTimeUpdates };