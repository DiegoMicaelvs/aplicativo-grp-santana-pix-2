// Configurações do sistema para produção
export const config = {
  // Detectar modo de produção
  isProduction: process.env.NODE_ENV === "production" || 
                process.env.PRODUCTION_MODE === "true" ||
                process.env.REPLIT_DEPLOYMENT === "1",
  
  // Configurações de segurança
  security: {
    // Senha master para operações críticas
    masterPassword: process.env.MASTER_PASSWORD || "Diego91425751",
    
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
  
  // Informações da empresa
  company: {
    name: "Grupo Santana Pix",
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