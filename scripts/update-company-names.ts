import { config } from "dotenv";
import { db } from "../db";
import { companies } from "../shared/schema";
import { eq, or } from "drizzle-orm";

// Load environment variables
config();

async function updateCompanyNames() {
  try {
    console.log("🔄 Atualizando nomes das empresas...");
    
    // Find existing companies with old names
    const existingCompanies = await db.query.companies.findMany({
      where: or(
        eq(companies.name, "Metis da Pix Proteção Veicular"),
        eq(companies.name, "Metis")
      )
    });
    
    console.log(`📋 Encontradas ${existingCompanies.length} empresas para atualizar:`);
    existingCompanies.forEach(company => {
      console.log(`  - ID ${company.id}: "${company.name}"`);
    });
    
    if (existingCompanies.length === 0) {
      console.log("✅ Nenhuma empresa encontrada para atualizar");
      return;
    }
    
    // Update all old company names to "Grupo Santana"
    const updateResult = await db
      .update(companies)
      .set({ name: "Grupo Santana" })
      .where(
        or(
          eq(companies.name, "Metis da Pix Proteção Veicular"),
          eq(companies.name, "Metis")
        )
      )
      .returning();
    
    console.log(`✅ ${updateResult.length} empresas atualizadas com sucesso:`);
    updateResult.forEach(company => {
      console.log(`  - ID ${company.id}: "${company.name}"`);
    });
    
    // Verify the changes
    const allCompanies = await db.query.companies.findMany();
    console.log("\n📊 Empresas no banco de dados após atualização:");
    allCompanies.forEach(company => {
      console.log(`  - ID ${company.id}: "${company.name}" (${company.isActive ? 'Ativa' : 'Inativa'})`);
    });
    
  } catch (error) {
    console.error("❌ Erro ao atualizar nomes das empresas:", error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  updateCompanyNames()
    .then(() => {
      console.log("\n🎉 Script executado com sucesso!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Erro ao executar script:", error);
      process.exit(1);
    });
}

export { updateCompanyNames };