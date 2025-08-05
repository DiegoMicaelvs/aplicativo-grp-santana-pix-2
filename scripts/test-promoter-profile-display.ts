import { db } from '../db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test script to verify promoter profile display with supervisor assignment
async function testPromoterProfileDisplay() {
  console.log('=== Testing Promoter Profile Display with Supervisor Assignment ===\n');
  
  try {
    // 1. Find all promoters with supervisors
    const promoters = await db.query.users.findMany({
      where: eq(users.role, 'promotor'),
      columns: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        supervisorId: true
      }
    });
    
    console.log(`Found ${promoters.length} promoters:`);
    
    for (const promoter of promoters) {
      console.log(`\n--- Promoter: ${promoter.fullName} ---`);
      console.log(`ID: ${promoter.id}`);
      console.log(`Email: ${promoter.email}`);
      console.log(`Phone: ${promoter.phone || 'Not provided'}`);
      
      if (promoter.supervisorId) {
        // Fetch supervisor details
        const supervisor = await db.query.users.findFirst({
          where: eq(users.id, promoter.supervisorId),
          columns: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            analystLevel: true
          }
        });
        
        if (supervisor) {
          console.log(`✓ Assigned to: ${supervisor.fullName} (${supervisor.role}${supervisor.analystLevel ? ` Level ${supervisor.analystLevel}` : ''})`);
        } else {
          console.log(`⚠ Supervisor ID ${promoter.supervisorId} not found`);
        }
      } else {
        console.log('✗ No supervisor assigned');
      }
    }
    
    // 2. Test assignment to verify display updates
    if (promoters.length > 0) {
      const testPromoter = promoters[0];
      console.log(`\n=== Testing Assignment Update ===`);
      
      // Find an analyst level 3
      const analyst = await db.query.users.findFirst({
        where: eq(users.role, 'analista'),
        columns: {
          id: true,
          fullName: true,
          analystLevel: true
        }
      });
      
      if (analyst && analyst.analystLevel === 3) {
        console.log(`Assigning promoter "${testPromoter.fullName}" to analyst "${analyst.fullName}"`);
        
        const [updated] = await db.update(users)
          .set({ 
            supervisorId: analyst.id,
            updatedAt: new Date()
          })
          .where(eq(users.id, testPromoter.id))
          .returning();
        
        console.log(`✓ Assignment successful! Supervisor ID: ${updated.supervisorId}`);
        
        // Verify the assignment
        const verifyPromoter = await db.query.users.findFirst({
          where: eq(users.id, testPromoter.id),
          columns: {
            id: true,
            fullName: true,
            supervisorId: true
          }
        });
        
        console.log(`\n=== Verification ===`);
        console.log(`Promoter ${verifyPromoter?.fullName} is now assigned to supervisor ID: ${verifyPromoter?.supervisorId}`);
      } else {
        console.log('No analyst level 3 found for testing');
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

testPromoterProfileDisplay();