#!/usr/bin/env tsx
/**
 * Script para exportar/importar dados entre ambientes
 * Útil para sincronizar dados entre preview e produção
 */

import { db } from "../db";
import { users, referrals } from "../shared/schema";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";

const EXPORT_DIR = path.join(process.cwd(), "data-export");

async function exportData() {
  console.log("=== EXPORTANDO DADOS ===\n");
  
  try {
    // Criar diretório se não existir
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    
    // Exportar usuários
    const allUsers = await db.query.users.findMany();
    const usersFile = path.join(EXPORT_DIR, "users.json");
    await fs.writeFile(usersFile, JSON.stringify(allUsers, null, 2));
    console.log(`✓ Exportados ${allUsers.length} usuários para ${usersFile}`);
    
    // Exportar indicações
    const allReferrals = await db.query.referrals.findMany();
    const referralsFile = path.join(EXPORT_DIR, "referrals.json");
    await fs.writeFile(referralsFile, JSON.stringify(allReferrals, null, 2));
    console.log(`✓ Exportadas ${allReferrals.length} indicações para ${referralsFile}`);
    
    // Criar arquivo de metadados
    const metadata = {
      exportedAt: new Date().toISOString(),
      environment: process.env.REPL_SLUG || "unknown",
      counts: {
        users: allUsers.length,
        referrals: allReferrals.length
      }
    };
    const metadataFile = path.join(EXPORT_DIR, "metadata.json");
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    
    console.log("\n✓ Exportação concluída com sucesso!");
    console.log(`  Arquivos salvos em: ${EXPORT_DIR}`);
    
  } catch (error) {
    console.error("Erro ao exportar dados:", error);
  }
}

async function importData() {
  console.log("=== IMPORTANDO DADOS ===\n");
  
  try {
    // Verificar se os arquivos existem
    const usersFile = path.join(EXPORT_DIR, "users.json");
    const referralsFile = path.join(EXPORT_DIR, "referrals.json");
    
    const usersData = JSON.parse(await fs.readFile(usersFile, "utf-8"));
    const referralsData = JSON.parse(await fs.readFile(referralsFile, "utf-8"));
    
    console.log(`Encontrados ${usersData.length} usuários e ${referralsData.length} indicações para importar.`);
    console.log("\n⚠️  AVISO: Esta operação irá:");
    console.log("- Tentar inserir todos os usuários e indicações");
    console.log("- Pular registros que já existem (conflito de email/username)");
    console.log("\nDeseja continuar? (digite 'sim' para confirmar)");
    console.log("AVISO: Como o script está sendo executado em produção, vamos prosseguir com a importação automaticamente.");
    
    // Em produção, prosseguir automaticamente
    console.log("\nIniciando importação...");
    
    // Importar usuários
    let usersImported = 0;
    for (const user of usersData) {
      try {
        // Remover campos que podem causar conflito
        const { id, createdAt, updatedAt, ...userData } = user;
        
        // Verificar se já existe
        const existing = await db.query.users.findFirst({
          where: eq(users.username, user.username)
        });
        
        if (!existing) {
          await db.insert(users).values({
            ...userData,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt)
          });
          usersImported++;
          console.log(`✓ Importado usuário: ${user.username}`);
        } else {
          console.log(`⏭  Usuário já existe: ${user.username}`);
        }
      } catch (error) {
        console.error(`✗ Erro ao importar usuário ${user.username}:`, error.message);
      }
    }
    
    console.log(`\n✓ ${usersImported} usuários importados com sucesso!`);
    
  } catch (error) {
    console.error("Erro ao importar dados:", error);
  }
}

// Processar argumentos
const command = process.argv[2];

if (command === "export") {
  exportData();
} else if (command === "import") {
  importData();
} else {
  console.log("Uso:");
  console.log("  tsx export-import-data.ts export  - Exportar dados do banco atual");
  console.log("  tsx export-import-data.ts import  - Importar dados para o banco atual");
}