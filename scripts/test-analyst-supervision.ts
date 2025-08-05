import { db } from '../db';
import { users, referrals } from '@shared/schema.ts';
import { eq, and, or, desc, ne, isNull } from 'drizzle-orm';

async function testAnalystSupervision() {
  try {
    console.log('\n=== TESTE DE SUPERVISÃO ANALISTA NÍVEL 3 ===\n');
    
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
    console.log(`   Nível: ${analyst.analystLevel}`);
    
    // Buscar usuários supervisionados
    console.log('\n--- USUÁRIOS SUPERVISIONADOS ---');
    const supervisedUsers = await db.query.users.findMany({
      where: eq(users.supervisorId, analyst.id),
      orderBy: desc(users.createdAt)
    });
    
    console.log(`Total de usuários supervisionados: ${supervisedUsers.length}`);
    supervisedUsers.forEach(u => {
      console.log(`  - ${u.fullName} (${u.username}) - Role: ${u.role}, SupervisorId: ${u.supervisorId}`);
    });
    
    // Buscar usuários NÃO supervisionados
    console.log('\n--- USUÁRIOS NÃO SUPERVISIONADOS ---');
    const unsupervisedUsers = await db.query.users.findMany({
      where: or(
        isNull(users.supervisorId),
        // Usuários com outros supervisores
        ne(users.supervisorId, analyst.id)
      ),
      orderBy: desc(users.createdAt)
    });
    
    console.log(`Total de usuários não supervisionados: ${unsupervisedUsers.length}`);
    unsupervisedUsers.forEach(u => {
      console.log(`  - ${u.fullName} (${u.username}) - Role: ${u.role}, SupervisorId: ${u.supervisorId}`);
    });
    
    // Verificar indicações
    console.log('\n--- INDICAÇÕES ---');
    const userIds = supervisedUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      const supervisedReferrals = await db.query.referrals.findMany({
        where: or(...userIds.map(id => eq(referrals.userId, id))),
        with: {
          user: true
        }
      });
      
      console.log(`Total de indicações de usuários supervisionados: ${supervisedReferrals.length}`);
      supervisedReferrals.forEach(r => {
        console.log(`  - Indicação #${r.id} - Cliente: ${r.name}, Usuário: ${r.user?.fullName}`);
      });
    } else {
      console.log('Nenhum usuário supervisionado encontrado para verificar indicações');
    }
    
    // Verificar se há usuários que deveriam estar supervisionados
    console.log('\n--- ANÁLISE DE ATRIBUIÇÃO ---');
    const indicadoresProblematicos = await db.query.users.findMany({
      where: and(
        eq(users.role, 'indicador'),
        or(
          isNull(users.supervisorId),
          ne(users.supervisorId, analyst.id)
        )
      )
    });
    
    if (indicadoresProblematicos.length > 0) {
      console.log(`⚠️  ${indicadoresProblematicos.length} indicadores não estão atribuídos ao analista nível 3:`);
      indicadoresProblematicos.forEach(u => {
        console.log(`  - ${u.fullName} (${u.username}) - SupervisorId: ${u.supervisorId}`);
      });
    } else {
      console.log('✅ Todos os indicadores estão corretamente atribuídos');
    }
    
  } catch (error) {
    console.error('Erro ao testar supervisão:', error);
  } finally {
    process.exit();
  }
}

testAnalystSupervision();