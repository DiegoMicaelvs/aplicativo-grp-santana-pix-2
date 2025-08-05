import { db } from '../db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function assignPromoterToAnalyst() {
  try {
    // Check for analyst level 3
    const analysts = await db.query.users.findMany({
      where: eq(users.role, 'analista')
    });

    console.log('All analysts:');
    analysts.forEach(a => {
      console.log(`- ${a.fullName} (ID: ${a.id}, Level: ${a.analystLevel})`);
    });

    // Assign promoter to analyst level 3 if exists
    const analystLevel3 = analysts.find(a => a.analystLevel === 3);
    if (analystLevel3) {
      console.log(`\nAssigning promoter to analyst level 3: ${analystLevel3.fullName}`);
      
      const [updated] = await db.update(users)
        .set({ 
          supervisorId: analystLevel3.id,
          updatedAt: new Date()
        })
        .where(eq(users.id, 9)) // Promoter ID from the test
        .returning();
        
      console.log(`Assignment complete! Promoter ${updated.fullName} now assigned to supervisor ID: ${updated.supervisorId}`);
    } else {
      console.log('\nNo analyst level 3 found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

assignPromoterToAnalyst();