import { db } from '../db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test script to verify promoter-analyst assignment display
async function testPromoterAnalystDisplay() {
  console.log('=== Testing Promoter-Analyst Assignment Display ===\n');
  
  try {
    // 1. Get all users to simulate the query result
    const allUsers = await db.query.users.findMany();
    
    console.log('Total users:', allUsers.length);
    
    // 2. Find all promoters and their supervisors
    const promoters = allUsers.filter(u => u.role === 'promotor');
    
    console.log(`\nPromoters and their assignments:`);
    for (const promoter of promoters) {
      console.log(`\nPromoter: ${promoter.fullName} (ID: ${promoter.id})`);
      
      if (promoter.supervisorId) {
        // Find the analyst with that ID
        const analyst = allUsers.find(u => 
          u.id === promoter.supervisorId && u.role === 'analista' && u.analystLevel === 3
        );
        
        if (analyst) {
          console.log(`✓ Assigned to: ${analyst.fullName} (Analyst Level ${analyst.analystLevel})`);
        } else {
          // Check if supervisor exists but is not analyst level 3
          const supervisor = allUsers.find(u => u.id === promoter.supervisorId);
          if (supervisor) {
            console.log(`⚠ Supervisor found but not analyst level 3: ${supervisor.fullName} (${supervisor.role}${supervisor.analystLevel ? ` Level ${supervisor.analystLevel}` : ''})`);
          } else {
            console.log(`✗ Supervisor ID ${promoter.supervisorId} not found`);
          }
        }
      } else {
        console.log('✗ No supervisor assigned');
      }
    }
    
    // 3. Test the logic used in admin-indicators.tsx
    console.log('\n=== Testing Admin Indicators Logic ===');
    
    const getAnalystAssignment = (userId: number) => {
      const user = allUsers.find((u: any) => u.id === userId);
      if (user?.role !== "promotor") return null;
      
      // Check if promoter has a supervisorId
      if (!user.supervisorId) return null;
      
      // Find the analyst with that ID
      const analyst = allUsers.find((u: any) => 
        u.id === user.supervisorId && u.role === "analista" && u.analystLevel === 3
      );
      
      return analyst ? analyst.fullName : null;
    };
    
    // Test with all users
    for (const user of allUsers) {
      if (user.role === 'promotor') {
        const assignment = getAnalystAssignment(user.id);
        console.log(`\n${user.fullName}: ${assignment || 'Sem atribuição'}`);
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

testPromoterAnalystDisplay();