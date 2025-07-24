/**
 * Sistema de validação cruzada entre aplicativos
 * Permite verificar duplicidades de CPF, telefone e placa entre diferentes instâncias
 */

import { db } from "@db";
import { users, referrals } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";

// Interface para resposta de validação
export interface CrossAppValidationResponse {
  isValid: boolean;
  isDuplicate: boolean;
  duplicateType?: 'cpf' | 'phone' | 'licensePlate';
  message?: string;
  existingData?: {
    appName: string;
    registeredAt: Date;
    userName?: string;
  };
}

// Configuração das APIs centrais de validação
export const CENTRAL_VALIDATION_APIS = [
  // Adicione aqui as URLs das APIs centrais dos aplicativos principais
  // Exemplo: 'https://app-principal.replit.app/api/validate'
];

/**
 * Registra as rotas de validação no Express
 */
export function registerCrossAppValidationRoutes(app: Express) {
  // Endpoint para validar dados de outros aplicativos
  app.post("/api/validate/cross-app", async (req, res) => {
    try {
      const { cpf, phone, licensePlate, appSecret } = req.body;
      
      // Verificar autenticação via app secret
      if (appSecret !== process.env.CROSS_APP_SECRET) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      
      const results: any[] = [];
      
      // Validar CPF se fornecido
      if (cpf) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.cpf, cpf)
        });
        
        if (existingUser) {
          results.push({
            type: 'cpf',
            isDuplicate: true,
            data: {
              userName: existingUser.fullName,
              registeredAt: existingUser.createdAt
            }
          });
        }
      }
      
      // Validar telefone se fornecido
      if (phone) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.phone, phone)
        });
        
        if (existingUser) {
          results.push({
            type: 'phone',
            isDuplicate: true,
            data: {
              userName: existingUser.fullName,
              registeredAt: existingUser.createdAt
            }
          });
        }
      }
      
      // Validar placa se fornecida
      if (licensePlate) {
        const existingReferral = await db.query.referrals.findFirst({
          where: eq(referrals.licensePlate, licensePlate),
          with: {
            user: true
          }
        });
        
        if (existingReferral) {
          results.push({
            type: 'licensePlate',
            isDuplicate: true,
            data: {
              userName: existingReferral.user.fullName,
              registeredAt: existingReferral.createdAt
            }
          });
        }
      }
      
      return res.json({
        duplicates: results,
        hasDuplicates: results.length > 0
      });
      
    } catch (error) {
      console.error("Erro na validação cruzada:", error);
      return res.status(500).json({ error: "Erro ao validar dados" });
    }
  });
}

/**
 * Valida dados contra outras instâncias do aplicativo
 */
export async function validateAgainstOtherApps(data: {
  cpf?: string;
  phone?: string;
  licensePlate?: string;
}): Promise<CrossAppValidationResponse> {
  // Se não houver APIs configuradas, considerar válido
  if (CENTRAL_VALIDATION_APIS.length === 0) {
    return { isValid: true, isDuplicate: false };
  }
  
  const appSecret = process.env.CROSS_APP_SECRET;
  if (!appSecret) {
    console.warn("[CROSS_APP] Secret não configurado, validação desabilitada");
    return { isValid: true, isDuplicate: false };
  }
  
  try {
    // Fazer requisições para todas as APIs centrais
    const validationPromises = CENTRAL_VALIDATION_APIS.map(async (apiUrl) => {
      try {
        const response = await fetch(`${apiUrl}/api/validate/cross-app`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...data,
            appSecret
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          return result;
        }
        
        return null;
      } catch (error) {
        console.error(`[CROSS_APP] Erro ao validar com ${apiUrl}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(validationPromises);
    
    // Verificar se alguma API retornou duplicata
    for (const result of results) {
      if (result && result.hasDuplicates && result.duplicates.length > 0) {
        const duplicate = result.duplicates[0];
        return {
          isValid: false,
          isDuplicate: true,
          duplicateType: duplicate.type,
          message: `Já existe um cadastro com este ${
            duplicate.type === 'cpf' ? 'CPF' : 
            duplicate.type === 'phone' ? 'telefone' : 
            'placa'
          } em outro aplicativo`,
          existingData: {
            appName: 'Outro aplicativo',
            registeredAt: new Date(duplicate.data.registeredAt),
            userName: duplicate.data.userName
          }
        };
      }
    }
    
    return { isValid: true, isDuplicate: false };
    
  } catch (error) {
    console.error("[CROSS_APP] Erro geral na validação:", error);
    // Em caso de erro, permitir o cadastro mas logar o problema
    return { isValid: true, isDuplicate: false };
  }
}

/**
 * Middleware para validar duplicatas antes de criar usuário
 */
export async function validateUserDuplicates(userData: {
  cpf: string;
  phone: string;
  email: string;
}): Promise<CrossAppValidationResponse> {
  // Primeiro validar localmente
  const localUserByCpf = await db.query.users.findFirst({
    where: eq(users.cpf, userData.cpf)
  });
  
  if (localUserByCpf) {
    return {
      isValid: false,
      isDuplicate: true,
      duplicateType: 'cpf',
      message: 'Este CPF já está cadastrado neste sistema'
    };
  }
  
  const localUserByPhone = await db.query.users.findFirst({
    where: eq(users.phone, userData.phone)
  });
  
  if (localUserByPhone) {
    return {
      isValid: false,
      isDuplicate: true,
      duplicateType: 'phone',
      message: 'Este telefone já está cadastrado neste sistema'
    };
  }
  
  // Depois validar contra outros apps
  return validateAgainstOtherApps({
    cpf: userData.cpf,
    phone: userData.phone
  });
}

/**
 * Middleware para validar duplicatas antes de criar indicação
 */
export async function validateReferralDuplicates(referralData: {
  phone: string;
  licensePlate: string;
}): Promise<CrossAppValidationResponse> {
  // Primeiro validar localmente
  const localReferralByPlate = await db.query.referrals.findFirst({
    where: eq(referrals.licensePlate, referralData.licensePlate)
  });
  
  if (localReferralByPlate) {
    return {
      isValid: false,
      isDuplicate: true,
      duplicateType: 'licensePlate',
      message: 'Esta placa já foi indicada neste sistema'
    };
  }
  
  const localReferralByPhone = await db.query.referrals.findFirst({
    where: eq(referrals.phone, referralData.phone)
  });
  
  if (localReferralByPhone) {
    return {
      isValid: false,
      isDuplicate: true,
      duplicateType: 'phone',
      message: 'Este telefone já foi indicado neste sistema'
    };
  }
  
  // Depois validar contra outros apps
  return validateAgainstOtherApps({
    phone: referralData.phone,
    licensePlate: referralData.licensePlate
  });
}