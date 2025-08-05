import { db } from '../db';
import { users } from '../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Script to assign indicadores to their promoters based on who created them
async function assignIndicadoresToPromoters() {
  console.log('=== Assigning Indicadores to Promoters ===\n');
  
  try {
    // 1. Get all users
    const allUsers = await db.query.users.findMany();
    
    // 2. Find indicadores created by promoters but without promoterId
    const indicadoresToUpdate = allUsers.filter(u => 
      u.role === 'indicador' && 
      !u.promoterId && 
      u.createdBy
    );
    
    console.log(`Found ${indicadoresToUpdate.length} indicadores to check\n`);
    
    for (const indicador of indicadoresToUpdate) {
      // Find who created this indicador
      const creator = allUsers.find(u => u.id === indicador.createdBy);
      
      if (creator && creator.role === 'promotor') {
        console.log(`Updating ${indicador.fullName} (ID: ${indicador.id})`);
        console.log(`  - Created by promoter: ${creator.fullName} (ID: ${creator.id})`);
        console.log(`  - Setting promoterId to: ${creator.id}`);
        
        // Update the indicador to set the promoterId
        await db.update(users)
          .set({ promoterId: creator.id })
          .where(eq(users.id, indicador.id));
        
        console.log(`  ✓ Updated successfully\n`);
      } else if (creator) {
        console.log(`${indicador.fullName} (ID: ${indicador.id}) was created by ${creator.fullName} (${creator.role}) - skipping\n`);
      }
    }
    
    // 3. Verify the updates
    console.log('\n=== Verification ===');
    const promoter = allUsers.find(u => u.username === 'promotordo@gmail.com');
    
    if (promoter) {
      const updatedIndicadores = await db.query.users.findMany({
        where: eq(users.promoterId, promoter.id)
      });
      
      console.log(`\nPromoter "${promoter.fullName}" now has ${updatedIndicadores.length} team members:`);
      updatedIndicadores.forEach(member => {
        console.log(`  - ${member.fullName} (${member.role})`);
      });
    }
    
  } catch (error) {
    console.error('Error during assignment:', error);
  }
  
  process.exit(0);
}

assignIndicadoresToPromoters();