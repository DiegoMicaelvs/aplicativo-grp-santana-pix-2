import { db } from "../db";
import { companies } from "@shared/schema.ts";
import { eq, isNull } from "drizzle-orm";
import crypto from "crypto";

// Generate a secure random token
function generateSecureToken(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = crypto.randomBytes(length);
  let token = '';
  
  for (let i = 0; i < length; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  
  return token;
}

async function generateCompanyTokens() {
  try {
    console.log("🔐 Gerando tokens públicos para empresas...");
    
    // Get all companies without a public token
    const companiesWithoutToken = await db.query.companies.findMany({
      where: isNull(companies.publicToken)
    });
    
    console.log(`📊 Encontradas ${companiesWithoutToken.length} empresas sem token`);
    
    if (companiesWithoutToken.length === 0) {
      console.log("✅ Todas as empresas já possuem tokens!");
      return;
    }
    
    // Generate and assign tokens
    for (const company of companiesWithoutToken) {
      let token = generateSecureToken(16);
      
      // Ensure uniqueness by checking if token already exists
      let existingToken = await db.query.companies.findFirst({
        where: eq(companies.publicToken, token)
      });
      
      // If token exists, generate a new one
      while (existingToken) {
        token = generateSecureToken(16);
        existingToken = await db.query.companies.findFirst({
          where: eq(companies.publicToken, token)
        });
      }
      
      // Update company with new token
      await db.update(companies)
        .set({ publicToken: token })
        .where(eq(companies.id, company.id));
      
      console.log(`✅ Token gerado para "${company.name}": ${token}`);
      console.log(`   Link público: /public-dashboard/${token}`);
    }
    
    console.log("\n🎉 Tokens gerados com sucesso!");
    console.log("\n📋 Resumo dos links públicos:");
    
    // Show all companies with their new tokens
    const allCompanies = await db.query.companies.findMany();
    for (const company of allCompanies) {
      if (company.publicToken) {
        console.log(`   ${company.name}: /public-dashboard/${company.publicToken}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Erro ao gerar tokens:", error);
    throw error;
  }
}

generateCompanyTokens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
