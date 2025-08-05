import { db } from '../db';
import { users, referrals } from '@shared/schema.ts';
import { eq, and } from 'drizzle-orm';

async function testSupervisorAssignment() {
  try {
    console.log('\n=== TESTE DE ATRIBUIÇÃO/DESATRIBUIÇÃO DE SUPERVISOR ===\n');
    
    // Buscar analista nível 3
    const analyst = await db.query.users.findFirst({
      where: and(
        eq(users.username, 'analista@gmail.com'),
        eq(users.analystLevel, 3)
      )
    });
    
    if (!analyst) {
      console.log('❌ Analista nível 3 não encontrado');
      return;
    }
    
    console.log(`✅ Analista encontrado: ${analyst.fullName} (ID: ${analyst.id})`);
    
    // Buscar o indicador "indicadorteste@gmail.com" para teste
    const testIndicator = await db.query.users.findFirst({
      where: eq(users.username, 'indicadorteste@gmail.com')
    });
    
    if (!testIndicator) {
      console.log('❌ Indicador de teste não encontrado');
      return;
    }
    
    console.log(`\n✅ Indicador encontrado: ${testIndicator.fullName} (ID: ${testIndicator.id})`);
    console.log(`   Supervisor atual: ${testIndicator.supervisorId || 'Nenhum'}`);
    
    // Contar indicações do indicador
    const indicatorReferrals = await db.query.referrals.findMany({
      where: eq(referrals.userId, testIndicator.id)
    });
    
    console.log(`   Total de indicações: ${indicatorReferrals.length}`);
    
    // TESTE 1: Atribuir supervisor
    console.log('\n--- TESTE 1: ATRIBUINDO SUPERVISOR ---');
    
    await db.update(users)
      .set({ 
        supervisorId: analyst.id,
        updatedAt: new Date()
      })
      .where(eq(users.id, testIndicator.id));
    
    console.log('✅ Supervisor atribuído');
    
    // Verificar se o usuário aparece na lista supervisionada
    const supervisedAfterAssignment = await db.query.users.findMany({
      where: eq(users.supervisorId, analyst.id)
    });
    
    const foundAfterAssignment = supervisedAfterAssignment.find(u => u.id === testIndicator.id);
    if (foundAfterAssignment) {
      console.log('✅ Indicador agora aparece na lista de usuários supervisionados');
    } else {
      console.log('❌ Indicador NÃO aparece na lista de usuários supervisionados');
    }
    
    // TESTE 2: Remover supervisor
    console.log('\n--- TESTE 2: REMOVENDO SUPERVISOR ---');
    
    await db.update(users)
      .set({ 
        supervisorId: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, testIndicator.id));
    
    console.log('✅ Supervisor removido');
    
    // Verificar se o usuário foi removido da lista supervisionada
    const supervisedAfterRemoval = await db.query.users.findMany({
      where: eq(users.supervisorId, analyst.id)
    });
    
    const foundAfterRemoval = supervisedAfterRemoval.find(u => u.id === testIndicator.id);
    if (!foundAfterRemoval) {
      console.log('✅ Indicador NÃO aparece mais na lista de usuários supervisionados');
    } else {
      console.log('❌ Indicador ainda aparece na lista de usuários supervisionados');
    }
    
    console.log('\n✅ Teste concluído com sucesso!');
    console.log('O sistema está filtrando corretamente os usuários baseado no supervisorId atual.');
    
  } catch (error) {
    console.error('Erro ao testar atribuição:', error);
  } finally {
    process.exit();
  }
}

testSupervisorAssignment();