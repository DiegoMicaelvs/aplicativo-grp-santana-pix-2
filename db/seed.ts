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
      email: "admin@gruposantana.com",
      password: adminPassword,
      fullName: "Administrador do Sistema",
      phone: "11999999999",
      cpf: "12345678900",
      address: "Grupo Santana, São Paulo - SP - 01000-000",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000-000",
      shirtSize: "M",
      pixKey: "admin@gruposantana.com",
      role: "admin",
      isActive: true
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
        email: "joao@example.com",
        password: referrerPassword,
        fullName: "João Silva",
        phone: "11988888888",
        cpf: "98765432100",
        address: "Rua das Flores, 123, São Paulo - SP - 01234-567",
        city: "São Paulo",
        state: "SP", 
        zipCode: "01234-567",
        shirtSize: "M",
        pixKey: "joao@example.com",
        role: "indicador",
        isActive: true
      }).returning({ id: schema.users.id });
      
      console.log("Example referrer created");
      
      // Create insurance companies
      const existingCompanies = await db.query.companies.findMany();
      const existingCompanyNames = existingCompanies.map(c => c.name);
      
      const companiesToCreate = [
        "Metis da Pix Proteção Veicular",
        "Metis",
        "Cativa",
        "Kin",
        "Associativa",
        "Top Brasil"
      ];
      
      // Only create companies that don't already exist
      const newCompanies = companiesToCreate.filter(name => !existingCompanyNames.includes(name));
      
      if (newCompanies.length > 0) {
        await db.insert(schema.companies).values(
          newCompanies.map(name => ({
            name,
            isActive: true
          }))
        );
        console.log(`Created ${newCompanies.length} new insurance companies`);
      }
      
      // Get a company for creating example referrals
      const companies = await db.query.companies.findMany();
      const company = companies[0];
      
      // Create example referrals
      await db.insert(schema.referrals).values([
        {
          userId: referrer.id,
          createdBy: referrer.id,
          fullName: "Maria Costa",
          phone: "11977777777",
          licensePlate: "ABC1234",
          hasInsurance: false,
          companyId: company.id,
          status: "converted",
          commissionIndicator: "3.00"
        },
        {
          userId: referrer.id,
          createdBy: referrer.id,
          fullName: "Paulo Ribeiro",
          phone: "11966666666",
          licensePlate: "DEF5678",
          hasInsurance: true,
          companyId: company.id,
          status: "rejected",
          notes: "Cliente já possui seguro"
        },
        {
          userId: referrer.id,
          createdBy: referrer.id,
          fullName: "Roberto Almeida",
          phone: "11955555555",
          licensePlate: "GHI9J12",
          hasInsurance: false,
          companyId: company.id,
          status: "validated"
        },
        {
          userId: referrer.id,
          createdBy: referrer.id,
          fullName: "Ana Santos",
          phone: "11944444444",
          licensePlate: "KLM3456",
          hasInsurance: false,
          companyId: company.id,
          status: "pending"
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
