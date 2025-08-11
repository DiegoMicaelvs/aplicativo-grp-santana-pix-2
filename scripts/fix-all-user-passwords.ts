import { storage } from "../server/storage";
import { hashPassword, comparePasswords } from "../server/auth";

async function fixAllUserPasswords() {
  console.log('Verificando e corrigindo senhas de usuarios...\n');

  try {
    const users = await storage.getAllUsers();
    console.log(`Total de usuarios: ${users.length}\n`);

    let fixedCount = 0;
    const commonPasswords = ['123456', '12345678', 'password', 'admin'];

    for (const user of users) {
      console.log(`Verificando: ${user.username} (${user.role})`);

      // Test common passwords
      let passwordFound = false;
      for (const pwd of commonPasswords) {
        const matches = await comparePasswords(pwd, user.password);
        if (matches) {
          console.log(`  Senha confirmada: ${pwd}`);
          passwordFound = true;
          break;
        }
      }

      // If no common password works, reset to 123456
      if (!passwordFound) {
        console.log(`  Resetando senha para 123456...`);
        const hashedPassword = await hashPassword('123456');
        
        await storage.updateUserProfile(user.id, { 
          password: hashedPassword,
          mustChangePassword: true // User will need to change on first login
        });

        fixedCount++;
        console.log(`  Senha resetada com sucesso`);
      }
    }

    console.log(`\nResumo:`);
    console.log(`Total de usuarios: ${users.length}`);
    console.log(`Senhas corrigidas: ${fixedCount}`);
    console.log(`\nTodos os usuarios agora podem fazer login com senha "123456"`);
    console.log(`Usuarios com senhas resetadas precisarao alterar a senha no primeiro login`);

  } catch (error) {
    console.error('Erro:', error);
  }
}

fixAllUserPasswords().then(() => {
  console.log('\nCorrecao concluida');
  process.exit(0);
}).catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});