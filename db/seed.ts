import { db } from "./index";
import * as schema from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  try {
    console.log("Starting database seed...");
    
    // Verificar e recriar o usuário admin com senha hash conhecida
    const adminExists = await db.query.users.findFirst({
      where: eq(schema.users.username, "admin@gruposantana.com")
    });
    
    if (adminExists) {
      await db.delete(schema.users).where(eq(schema.users.id, adminExists.id));
      console.log("Admin user removed");
    }
    
    // Garantir que o hash da senha seja sempre o mesmo para facilitar login
    const adminPassword = await hashPassword("admin123");
    
    // Criar usuário admin com a nova senha
    await db.insert(schema.users).values({
      username: "admin@gruposantana.com",
      password: adminPassword,
      firstName: "Administrador",
      lastName: "Sistema",
      phone: "11999999999",
      cpf: "12345678900",
      birthdate: "1980-01-01",
      role: "admin"
    });
    console.log("Admin user created with password 'admin123'");
    
    // Create example referrer
    const referrerExists = await db.query.users.findFirst({
      where: eq(schema.users.username, "joao@example.com")
    });
    
    if (!referrerExists) {
      const referrerPassword = await hashPassword("senha123");
      const [referrer] = await db.insert(schema.users).values({
        username: "joao@example.com",
        password: referrerPassword,
        firstName: "João",
        lastName: "Silva",
        phone: "11988888888",
        cpf: "98765432100",
        birthdate: "1990-05-15",
        bank: "Banco do Brasil",
        agency: "1234",
        account: "56789-0",
        role: "referrer"
      }).returning({ id: schema.users.id });
      
      console.log("Example referrer created");
      
      // Create example referrals
      await db.insert(schema.referrals).values([
        {
          userId: referrer.id,
          firstName: "Maria",
          lastName: "Costa",
          email: "maria@example.com",
          phone: "11977777777",
          licensePlate: "ABC1234",
          status: "converted",
          commission: "450.00",
          paidAt: new Date(2023, 3, 15), // April 15, 2023
          createdAt: new Date(2023, 3, 12), // April 12, 2023
          updatedAt: new Date(2023, 3, 12)
        },
        {
          userId: referrer.id,
          firstName: "Paulo",
          lastName: "Ribeiro",
          email: "paulo@example.com",
          phone: "11966666666",
          licensePlate: "DEF5678",
          status: "rejected",
          notes: "Cliente já possui seguro",
          createdAt: new Date(2023, 3, 5), // April 5, 2023
          updatedAt: new Date(2023, 3, 5)
        },
        {
          userId: referrer.id,
          firstName: "Roberto",
          lastName: "Almeida",
          email: "roberto@example.com",
          phone: "11955555555",
          licensePlate: "GHI9J12",
          status: "processing",
          createdAt: new Date(2023, 3, 8), // April 8, 2023
          updatedAt: new Date(2023, 3, 8)
        },
        {
          userId: referrer.id,
          firstName: "Ana",
          lastName: "Santos",
          email: "ana@example.com",
          phone: "11944444444",
          licensePlate: "KLM3456",
          status: "pending",
          createdAt: new Date(2023, 3, 10), // April 10, 2023
          updatedAt: new Date(2023, 3, 10)
        }
      ]);
      
      console.log("Example referrals created");
    } else {
      console.log("Example referrer already exists");
    }
    
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error during seed:", error);
  }
}

seed();
