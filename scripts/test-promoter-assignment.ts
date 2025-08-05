import { db } from '../db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test script to verify promoter assignment to analyst level 3
async function testPromoterAssignment() {
  console.log('=== Testing Promoter Assignment to Analyst Level 3 ===\n');
  
  try {
    // 1. Find all promoters
    const promoters = await db.query.users.findMany({
      where: eq(users.role, 'promotor'),
      columns: {
        id: true,
        fullName: true,
        username: true,
        supervisorId: true
      }
    });
    
    console.log(`Found ${promoters.length} promoters:`);
    promoters.forEach(p => {
      console.log(`- ${p.fullName} (ID: ${p.id}) - Supervisor: ${p.supervisorId || 'None'}`);
    });
    
    // 2. Find all analyst level 3
    const analystsLevel3 = await db.query.users.findMany({
      where: eq(users.role, 'analista'),
      columns: {
        id: true,
        fullName: true,
        analystLevel: true
      }
    });
    
    const level3Analysts = analystsLevel3.filter(a => a.analystLevel === 3);
    
    console.log(`\nFound ${level3Analysts.length} level 3 analysts:`);
    level3Analysts.forEach(a => {
      console.log(`- ${a.fullName} (ID: ${a.id})`);
    });
    
    // 3. Test assignment
    if (promoters.length > 0 && level3Analysts.length > 0) {
      const promoter = promoters[0];
      const analyst = level3Analysts[0];
      
      console.log(`\n=== Testing Assignment ===`);
      console.log(`Assigning promoter "${promoter.fullName}" to analyst "${analyst.fullName}"`);
      
      // Assign promoter to analyst
      const [updated] = await db.update(users)
        .set({ 
          supervisorId: analyst.id,
          updatedAt: new Date()
        })
        .where(eq(users.id, promoter.id))
        .returning();
      
      console.log(`✓ Assignment successful!`);
      console.log(`Promoter ${updated.fullName} now supervised by analyst ID: ${updated.supervisorId}`);
      
      // 4. Verify the assignment
      const verifyPromoter = await db.query.users.findFirst({
        where: eq(users.id, promoter.id),
        columns: {
          id: true,
          fullName: true,
          supervisorId: true
        }
      });
      
      console.log(`\n=== Verification ===`);
      console.log(`Promoter ${verifyPromoter?.fullName} supervisor ID: ${verifyPromoter?.supervisorId}`);
      
      // 5. Test unassignment
      console.log(`\n=== Testing Unassignment ===`);
      const [unassigned] = await db.update(users)
        .set({ 
          supervisorId: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, promoter.id))
        .returning();
      
      console.log(`✓ Unassignment successful!`);
      console.log(`Promoter ${unassigned.fullName} supervisor ID: ${unassigned.supervisorId}`);
    } else {
      console.log('\nNo promoters or level 3 analysts found to test assignment.');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

testPromoterAssignment();