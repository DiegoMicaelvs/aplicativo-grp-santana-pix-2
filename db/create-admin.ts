import { db } from "./index";
import { users } from "@shared/schema";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

async function createOrUpdateAdmin() {
  try {
    console.log("Verificando usuário administrador...");
    
    // Hash da senha
    const hashedPassword = await hashPassword("Diego91425751.");
    
    // Verificar se já existe um admin
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.username, "admin@gruposantana.com")
    });
    
    if (existingAdmin) {
      // Atualizar a senha do admin existente
      const [updatedAdmin] = await db.update(users)
        .set({ 
          password: hashedPassword,
          role: "admin",
          isActive: true
        })
        .where(eq(users.id, existingAdmin.id))
        .returning();
      
      console.log("Senha do administrador atualizada com sucesso!");
      console.log("Email: admin@gruposantana.com");
      console.log("Senha: Diego91425751.");
      console.log("ID:", updatedAdmin.id);
    } else {
      // Criar novo admin
      const [newAdmin] = await db.insert(users).values({
        username: "admin@gruposantana.com",
        email: "admin@gruposantana.com",
        password: hashedPassword,
        fullName: "Administrador do Sistema",
        cpf: "12345678901", // CPF único
        phone: "11999999999",
        address: "Grupo Santana",
        shirtSize: "M",
        pixKey: "admin@gruposantana.com",
        role: "admin",
        isActive: true,
        balance: "0",
        totalEarnings: "0"
      }).returning();
      
      console.log("Administrador criado com sucesso!");
      console.log("Email: admin@gruposantana.com");
      console.log("Senha: Diego91425751.");
      console.log("ID:", newAdmin.id);
    }
    
  } catch (error) {
    console.error("Erro ao criar/atualizar administrador:", error);
  } finally {
    process.exit(0);
  }
}

createOrUpdateAdmin();