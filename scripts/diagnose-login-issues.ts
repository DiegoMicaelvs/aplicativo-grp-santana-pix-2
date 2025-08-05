import { db } from "../db";
import { users } from "@shared/schema.ts";
import { comparePasswords, hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

async function diagnoseLoginIssues() {
  console.log("=== Diagnóstico de Problemas de Login ===\n");
  
  try {
    // Buscar todos os usuários
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)]
    });
    
    console.log(`Total de usuários no sistema: ${allUsers.length}\n`);
    
    // Verificar usuários com possíveis problemas
    console.log("=== Verificando Usuários ===");
    for (const user of allUsers) {
      console.log(`\nUsuário: ${user.username}`);
      console.log(`- ID: ${user.id}`);
      console.log(`- Nome: ${user.fullName}`);
      console.log(`- Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
      console.log(`- Papel: ${user.role}`);
      console.log(`- Criado em: ${user.createdAt}`);
      
      // Verificar formato da senha
      const passwordParts = user.password.split('.');
      if (passwordParts.length !== 2) {
        console.log(`⚠️  PROBLEMA: Formato de senha inválido!`);
      } else {
        console.log(`- Formato de senha: OK (hash.salt)`);
      }
      
      // Verificar se o username tem espaços extras ou maiúsculas
      if (user.username !== user.username.trim().toLowerCase()) {
        console.log(`⚠️  AVISO: Username não normalizado (tem espaços ou maiúsculas)`);
      }
    }
    
    // Testar criação e verificação de senha
    console.log("\n=== Teste de Hash de Senha ===");
    const testPassword = "teste123";
    const hashedTest = await hashPassword(testPassword);
    console.log(`Senha teste: ${testPassword}`);
    console.log(`Hash gerado: ${hashedTest.substring(0, 20)}...`);
    
    const matchTest = await comparePasswords(testPassword, hashedTest);
    console.log(`Verificação correta: ${matchTest ? 'OK' : 'FALHOU'}`);
    
    const wrongMatch = await comparePasswords("senhaerrada", hashedTest);
    console.log(`Verificação incorreta: ${wrongMatch ? 'FALHOU' : 'OK'}`);
    
    // Verificar usuários criados recentemente
    console.log("\n=== Usuários Criados Recentemente (últimos 7 dias) ===");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = allUsers.filter(u => 
      new Date(u.createdAt) > sevenDaysAgo
    );
    
    if (recentUsers.length === 0) {
      console.log("Nenhum usuário criado nos últimos 7 dias");
    } else {
      for (const user of recentUsers) {
        console.log(`- ${user.username} (${user.fullName}) - criado em ${user.createdAt}`);
      }
    }
    
    // Verificar se há duplicatas de username (case insensitive)
    console.log("\n=== Verificando Duplicatas de Username ===");
    const usernameMap = new Map<string, number>();
    for (const user of allUsers) {
      const normalizedUsername = user.username.toLowerCase().trim();
      const count = usernameMap.get(normalizedUsername) || 0;
      usernameMap.set(normalizedUsername, count + 1);
    }
    
    const duplicates = Array.from(usernameMap.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log("⚠️  DUPLICATAS ENCONTRADAS:");
      for (const [username, count] of duplicates) {
        console.log(`- ${username}: ${count} ocorrências`);
      }
    } else {
      console.log("✓ Nenhuma duplicata encontrada");
    }
    
  } catch (error) {
    console.error("Erro ao diagnosticar problemas:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

diagnoseLoginIssues();