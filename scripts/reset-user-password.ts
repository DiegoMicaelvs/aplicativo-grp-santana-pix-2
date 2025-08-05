import { db } from "../db";
import { users } from "@shared/schema.ts";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function resetUserPassword() {
  console.log("=== Reset de Senha de Usuário ===\n");
  
  try {
    // Solicitar email/username do usuário
    const username = await question("Digite o email/username do usuário: ");
    const normalizedUsername = username.trim().toLowerCase();
    
    // Buscar usuário
    const user = await db.query.users.findFirst({
      where: eq(users.username, normalizedUsername)
    });
    
    if (!user) {
      console.log("\n❌ Usuário não encontrado!");
      console.log("Verifique se o email está correto e em minúsculas.");
      rl.close();
      process.exit(1);
    }
    
    console.log(`\n✓ Usuário encontrado: ${user.fullName} (${user.username})`);
    console.log(`- Papel: ${user.role}`);
    console.log(`- Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
    
    // Solicitar nova senha
    const newPassword = await question("\nDigite a nova senha: ");
    
    if (newPassword.length < 6) {
      console.log("\n❌ A senha deve ter pelo menos 6 caracteres!");
      rl.close();
      process.exit(1);
    }
    
    // Confirmar ação
    const confirm = await question(`\nDeseja resetar a senha do usuário ${user.fullName}? (s/n): `);
    
    if (confirm.toLowerCase() !== 's') {
      console.log("\nOperação cancelada.");
      rl.close();
      process.exit(0);
    }
    
    // Gerar novo hash
    console.log("\nGerando nova senha...");
    const hashedPassword = await hashPassword(newPassword);
    
    // Atualizar senha no banco
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
    
    console.log("\n✓ Senha resetada com sucesso!");
    console.log(`\nInformações para o usuário:`);
    console.log(`- Email/Username: ${user.username}`);
    console.log(`- Nova senha: ${newPassword}`);
    console.log("\n⚠️  Lembre o usuário de alterar a senha após o primeiro login!");
    
  } catch (error) {
    console.error("\n❌ Erro ao resetar senha:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
  
  process.exit(0);
}

resetUserPassword();