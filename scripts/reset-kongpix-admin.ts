import { db } from "../db";
import { users } from "@shared/schema";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

async function resetKongPixAdmin() {
  try {
    console.log("Resetando senha do admin@kongpix.com.br...");
    
    // Nova senha
    const newPassword = "admin123";
    const hashedPassword = await hashPassword(newPassword);
    
    // Atualizar a senha
    const [updatedAdmin] = await db.update(users)
      .set({ 
        password: hashedPassword,
        isActive: true
      })
      .where(eq(users.username, "admin@kongpix.com.br"))
      .returning();
    
    if (updatedAdmin) {
      console.log("✅ Senha resetada com sucesso!");
      console.log("----------------------------");
      console.log("Email: admin@kongpix.com.br");
      console.log("Senha: admin123");
      console.log("----------------------------");
    } else {
      console.log("❌ Admin não encontrado");
    }
    
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
  } finally {
    process.exit(0);
  }
}

resetKongPixAdmin();