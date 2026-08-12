const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.PRODUCTION_MODE === "true";

/**
 * A senha master tinha um valor real embutido como fallback, versionado em um
 * repositório público. Qualquer pessoa com acesso ao código conseguia executar
 * as operações críticas protegidas por ela.
 *
 * Agora ela é obrigatória via ambiente. Em produção, a ausência derruba o boot
 * em vez de silenciosamente aceitar um valor conhecido.
 */
function resolveMasterPassword(): string {
  const fromEnv = process.env.MASTER_PASSWORD;
  if (fromEnv) return fromEnv;

  if (isProduction) {
    throw new Error(
      "MASTER_PASSWORD é obrigatório em produção. Defina a variável de ambiente.",
    );
  }

  console.warn(
    "[CONFIG] MASTER_PASSWORD não definido — operações críticas ficam bloqueadas " +
      "neste ambiente. Defina a variável no .env para habilitá-las.",
  );
  // String vazia nunca confere: em dev sem a variável, as operações críticas
  // simplesmente não passam, em vez de aceitarem uma senha conhecida.
  return "";
}

// Configurações do sistema para produção
export const config = {
  // Detectar modo de produção
  isProduction,

  // Configurações de segurança
  security: {
    // Senha master para operações críticas (obrigatória via env)
    masterPassword: resolveMasterPassword(),

    // Configurações de sessão
    session: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
      secure: process.env.NODE_ENV === "production" || process.env.PRODUCTION_MODE === "true",
    },
    
    // Rate limiting
    rateLimit: {
      loginAttempts: process.env.PRODUCTION_MODE === "true" ? 3 : 5,
      windowMinutes: process.env.PRODUCTION_MODE === "true" ? 30 : 15,
    }
  },
  
  // Configurações de comissão
  commission: {
    perReferral: 3.00, // R$ 3,00 por indicação
    perConversion: 50.00, // R$ 50,00 por conversão
    promoterPerIndicator: 1.00, // R$ 1,00 por indicador cadastrado
    promoterPerSale: 10.00, // R$ 10,00 por venda do indicador
  },
  
  // Configurações de paginação
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Configurações de upload
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  },
  
  // Informações da marca/empresa.
  // `name` é o nome do PRODUTO (aparece em SMS e relatórios).
  // A razão social permanece Grupo Santana nos textos legais/INPI.
  company: {
    name: "Valida",
    cnpj: "00.000.000/0001-00", // ATUALIZAR COM CNPJ REAL
    email: "admin@gruposantana.com.br",
    privacyEmail: "privacidade@gruposantana.com.br",
    website: "https://gruposantana.com.br",
    social: {
      instagram: "https://www.instagram.com/gruposantana/",
      facebook: "https://www.facebook.com/gruposantana",
    }
  }
};