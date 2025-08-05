import { db } from '../db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test script to verify promoter team members
async function testPromoterTeamMembers() {
  console.log('=== Testing Promoter Team Members ===\n');
  
  try {
    // 1. Get all users
    const allUsers = await db.query.users.findMany();
    
    console.log('Total users:', allUsers.length);
    
    // 2. Find the promoter "promotordo@gmail.com"
    const promoter = allUsers.find(u => u.username === 'promotordo@gmail.com');
    
    if (!promoter) {
      console.log('Promoter not found!');
      process.exit(1);
    }
    
    console.log(`\nPromoter found: ${promoter.fullName} (ID: ${promoter.id})`);
    
    // 3. Find all users with this promoterId
    const teamMembers = allUsers.filter(u => u.promoterId === promoter.id);
    
    console.log(`\nTeam members with promoterId = ${promoter.id}:`);
    if (teamMembers.length === 0) {
      console.log('No team members found with this promoterId');
    } else {
      teamMembers.forEach(member => {
        console.log(`- ${member.fullName} (${member.role}) - ID: ${member.id}`);
      });
    }
    
    // 4. Check if there are any indicadores without promoterId
    const indicadoresWithoutPromoter = allUsers.filter(u => u.role === 'indicador' && !u.promoterId);
    
    console.log(`\nIndicadores without promoterId:`);
    if (indicadoresWithoutPromoter.length === 0) {
      console.log('All indicadores have a promoterId assigned');
    } else {
      indicadoresWithoutPromoter.forEach(indicador => {
        console.log(`- ${indicador.fullName} (ID: ${indicador.id}) - Created by: ${indicador.createdBy}`);
      });
    }
    
    // 5. Check all users and their promoterId
    console.log('\n=== All Users and their PromoterId ===');
    allUsers.forEach(user => {
      console.log(`${user.fullName} (${user.role}) - ID: ${user.id}, PromoterId: ${user.promoterId || 'none'}`);
    });
    
    // 6. Test the storage function directly
    const { storage } = await import('../server/storage');
    const indicadoresFromStorage = await storage.getIndicadoresByPromoter(promoter.id);
    
    console.log(`\n=== Testing storage.getIndicadoresByPromoter(${promoter.id}) ===`);
    console.log('Result count:', indicadoresFromStorage.length);
    if (indicadoresFromStorage.length > 0) {
      indicadoresFromStorage.forEach(ind => {
        console.log(`- ${ind.fullName} (ID: ${ind.id})`);
      });
    } else {
      console.log('No indicadores found for this promoter');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

testPromoterTeamMembers();