import { storage } from "../server/storage";
import { hashPassword, comparePasswords } from "../server/auth";

async function fixAdminLogin() {
  console.log('Fixing admin login...\n');

  try {
    const admin = await storage.getUserByUsername('admin@hotmail.com');
    
    if (!admin) {
      console.log('Admin user not found');
      return;
    }

    console.log(`Admin found: ${admin.username} (ID: ${admin.id})`);
    console.log(`Active: ${admin.isActive}, Role: ${admin.role}`);

    // Reset to known password
    const newPassword = '123456';
    const hashedPassword = await hashPassword(newPassword);
    
    await storage.updateUserProfile(admin.id, { 
      password: hashedPassword,
      mustChangePassword: false
    });

    // Test the new password
    const verification = await comparePasswords(newPassword, hashedPassword);
    console.log(`Password test: ${verification ? 'SUCCESS' : 'FAILED'}`);

    console.log(`\nAdmin password reset complete!`);
    console.log(`Email: admin@hotmail.com`);
    console.log(`Password: ${newPassword}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

fixAdminLogin().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});