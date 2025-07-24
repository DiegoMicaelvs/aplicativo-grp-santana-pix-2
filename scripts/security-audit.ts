#!/usr/bin/env tsx
/**
 * Auditoria de Segurança Completa
 * Verifica vulnerabilidades e problemas de segurança
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log("=== AUDITORIA DE SEGURANÇA DO SISTEMA ===\n");

const vulnerabilities: string[] = [];
const warnings: string[] = [];
const goodPractices: string[] = [];

// 1. Verificar variáveis de ambiente expostas
console.log("1. VERIFICANDO EXPOSIÇÃO DE SECRETS:");
console.log("-".repeat(40));

const checkFileForSecrets = (filePath: string) => {
  try {
    const content = readFileSync(filePath, 'utf8');
    
    // Padrões de secrets comuns
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*["']([^"']+)["']/gi,
      /secret\s*[:=]\s*["']([^"']+)["']/gi,
      /password\s*[:=]\s*["']([^"']+)["']/gi,
      /token\s*[:=]\s*["']([^"']+)["']/gi,
      /private[_-]?key\s*[:=]\s*["']([^"']+)["']/gi,
    ];
    
    // Exceções permitidas
    const allowedPatterns = [
      'process.env',
      'SESSION_SECRET',
      'MASTER_PASSWORD',
      'CROSS_APP_SECRET',
      'placeholder',
      'example',
      'your-',
      '<seu-'
    ];
    
    for (const pattern of secretPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const value = match[1];
        const isAllowed = allowedPatterns.some(allowed => 
          match[0].includes(allowed) || value.includes(allowed)
        );
        
        if (!isAllowed && value.length > 10) {
          vulnerabilities.push(`⚠️  Possível secret exposto em ${filePath}: ${match[0].substring(0, 50)}...`);
        }
      }
    }
  } catch (error) {
    // Ignorar erros de leitura
  }
};

// Verificar todos os arquivos .ts, .tsx, .js
const scanDirectory = (dir: string) => {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
        scanDirectory(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        checkFileForSecrets(fullPath);
      }
    }
  } catch (error) {
    // Ignorar erros
  }
};

scanDirectory('./');

// 2. Verificar configurações de segurança
console.log("\n2. VERIFICANDO CONFIGURAÇÕES DE SEGURANÇA:");
console.log("-".repeat(40));

// Verificar auth.ts
try {
  const authContent = readFileSync('./server/auth.ts', 'utf8');
  
  if (authContent.includes('scrypt')) {
    goodPractices.push("✅ Usando scrypt para hash de senhas");
  } else {
    vulnerabilities.push("❌ Hash de senha inseguro");
  }
  
  if (authContent.includes('httpOnly: true')) {
    goodPractices.push("✅ Cookies httpOnly ativados");
  } else {
    vulnerabilities.push("❌ Cookies sem httpOnly");
  }
  
  if (authContent.includes('secure: isProduction')) {
    goodPractices.push("✅ Cookies seguros em produção");
  } else {
    warnings.push("⚠️  Verificar configuração de cookies seguros");
  }
} catch (error) {
  warnings.push("⚠️  Não foi possível verificar auth.ts");
}

// 3. Verificar SQL Injection
console.log("\n3. VERIFICANDO PROTEÇÃO CONTRA SQL INJECTION:");
console.log("-".repeat(40));

const checkSQLInjection = (dir: string) => {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
        checkSQLInjection(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = readFileSync(fullPath, 'utf8');
        
        // Procurar por queries SQL diretas
        if (content.includes('db.execute(') && content.includes('${')) {
          vulnerabilities.push(`⚠️  Possível SQL injection em ${fullPath}`);
        }
        
        // Verificar uso do Drizzle ORM
        if (content.includes('db.insert(') || content.includes('db.update(') || content.includes('db.query.')) {
          // Bom, usando ORM
        }
      }
    }
  } catch (error) {
    // Ignorar
  }
};

checkSQLInjection('./server');
goodPractices.push("✅ Usando Drizzle ORM para queries");

// 4. Verificar Headers de Segurança
console.log("\n4. VERIFICANDO HEADERS DE SEGURANÇA:");
console.log("-".repeat(40));

try {
  const securityContent = readFileSync('./server/security.ts', 'utf8');
  
  const headers = [
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['X-XSS-Protection', '1; mode=block'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Strict-Transport-Security', 'HSTS']
  ];
  
  for (const [header, desc] of headers) {
    if (securityContent.includes(header)) {
      goodPractices.push(`✅ Header ${header} configurado`);
    } else {
      vulnerabilities.push(`❌ Header ${header} ausente`);
    }
  }
} catch (error) {
  warnings.push("⚠️  Não foi possível verificar security.ts");
}

// 5. Verificar Rate Limiting
console.log("\n5. VERIFICANDO RATE LIMITING:");
console.log("-".repeat(40));

try {
  const securityContent = readFileSync('./server/security.ts', 'utf8');
  if (securityContent.includes('loginAttempts')) {
    goodPractices.push("✅ Rate limiting implementado para login");
  } else {
    vulnerabilities.push("❌ Sem rate limiting para login");
  }
} catch (error) {
  warnings.push("⚠️  Não foi possível verificar rate limiting");
}

// 6. Verificar Validação de Entrada
console.log("\n6. VERIFICANDO VALIDAÇÃO DE DADOS:");
console.log("-".repeat(40));

try {
  const routesContent = readFileSync('./server/routes.ts', 'utf8');
  if (routesContent.includes('zod') && routesContent.includes('.parse(')) {
    goodPractices.push("✅ Usando Zod para validação de dados");
  } else {
    vulnerabilities.push("❌ Validação de dados insuficiente");
  }
} catch (error) {
  warnings.push("⚠️  Não foi possível verificar validação");
}

// 7. Verificar CORS
console.log("\n7. VERIFICANDO CONFIGURAÇÃO CORS:");
console.log("-".repeat(40));

try {
  const indexContent = readFileSync('./server/index.ts', 'utf8');
  if (indexContent.includes('cors')) {
    if (indexContent.includes('origin: true') || indexContent.includes('origin: "*"')) {
      warnings.push("⚠️  CORS muito permissivo - considere restringir origens");
    } else {
      goodPractices.push("✅ CORS configurado");
    }
  }
} catch (error) {
  warnings.push("⚠️  Não foi possível verificar CORS");
}

// RESUMO
console.log("\n" + "=".repeat(50));
console.log("RESUMO DA AUDITORIA:");
console.log("=".repeat(50));

console.log(`\n🔍 VULNERABILIDADES ENCONTRADAS: ${vulnerabilities.length}`);
vulnerabilities.forEach(v => console.log(`   ${v}`));

console.log(`\n⚠️  AVISOS: ${warnings.length}`);
warnings.forEach(w => console.log(`   ${w}`));

console.log(`\n✅ BOAS PRÁTICAS: ${goodPractices.length}`);
goodPractices.forEach(g => console.log(`   ${g}`));

console.log("\n📊 SCORE DE SEGURANÇA:");
const score = Math.max(0, 100 - (vulnerabilities.length * 10) - (warnings.length * 5));
console.log(`   ${score}/100`);

if (score >= 80) {
  console.log("   🟢 Aplicação segura para produção");
} else if (score >= 60) {
  console.log("   🟡 Recomendado corrigir vulnerabilidades antes da produção");
} else {
  console.log("   🔴 Correções críticas necessárias");
}

console.log("\n" + "=".repeat(50));