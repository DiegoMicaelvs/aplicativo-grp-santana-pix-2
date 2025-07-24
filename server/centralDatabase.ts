/**
 * Conexão com banco de dados central para validação entre aplicativos
 * Este módulo permite verificar duplicidades entre diferentes instâncias do sistema
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { eq, or, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

// Configurar websocket para Neon
neonConfig.webSocketConstructor = ws;

// Interface para resultados de validação
export interface ValidationResult {
  isDuplicate: boolean;
  type: 'cpf' | 'phone' | 'licensePlate';
  existingApp?: string;
  existingUser?: string;
  registeredAt?: Date;
}

class CentralDatabaseValidator {
  private pool: Pool | null = null;
  private db: any = null;
  private isConfigured: boolean = false;

  constructor() {
    // A URL do banco central deve ser configurada via variável de ambiente
    const centralDbUrl = process.env.CENTRAL_DATABASE_URL;
    
    if (centralDbUrl) {
      try {
        this.pool = new Pool({ connectionString: centralDbUrl });
        this.db = drizzle({ client: this.pool, schema });
        this.isConfigured = true;
        console.log("[CENTRAL_DB] Conexão com banco central configurada");
      } catch (error) {
        console.error("[CENTRAL_DB] Erro ao configurar banco central:", error);
        this.isConfigured = false;
      }
    } else {
      console.log("[CENTRAL_DB] URL do banco central não configurada");
    }
  }

  /**
   * Verifica se o validador está configurado e pronto para uso
   */
  isReady(): boolean {
    return this.isConfigured && this.db !== null;
  }

  /**
   * Valida se um CPF já existe em qualquer aplicativo
   */
  async validateCPF(cpf: string, currentAppId?: string): Promise<ValidationResult> {
    if (!this.isReady()) {
      return { isDuplicate: false, type: 'cpf' };
    }

    try {
      const existing = await this.db.query.users.findFirst({
        where: eq(schema.users.cpf, cpf)
      });

      if (existing) {
        // Se for do mesmo app, não é duplicata entre apps
        if (currentAppId && existing.appId === currentAppId) {
          return { isDuplicate: false, type: 'cpf' };
        }

        return {
          isDuplicate: true,
          type: 'cpf',
          existingApp: existing.appId || 'principal',
          existingUser: existing.fullName,
          registeredAt: existing.createdAt
        };
      }

      return { isDuplicate: false, type: 'cpf' };
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao validar CPF:", error);
      return { isDuplicate: false, type: 'cpf' };
    }
  }

  /**
   * Valida se um telefone já existe em qualquer aplicativo
   */
  async validatePhone(phone: string, currentAppId?: string): Promise<ValidationResult> {
    if (!this.isReady()) {
      return { isDuplicate: false, type: 'phone' };
    }

    try {
      const existing = await this.db.query.users.findFirst({
        where: eq(schema.users.phone, phone)
      });

      if (existing) {
        if (currentAppId && existing.appId === currentAppId) {
          return { isDuplicate: false, type: 'phone' };
        }

        return {
          isDuplicate: true,
          type: 'phone',
          existingApp: existing.appId || 'principal',
          existingUser: existing.fullName,
          registeredAt: existing.createdAt
        };
      }

      return { isDuplicate: false, type: 'phone' };
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao validar telefone:", error);
      return { isDuplicate: false, type: 'phone' };
    }
  }

  /**
   * Valida se uma placa já existe em qualquer aplicativo
   */
  async validateLicensePlate(licensePlate: string, currentAppId?: string): Promise<ValidationResult> {
    if (!this.isReady()) {
      return { isDuplicate: false, type: 'licensePlate' };
    }

    try {
      const existing = await this.db.query.referrals.findFirst({
        where: eq(schema.referrals.licensePlate, licensePlate),
        with: {
          user: true
        }
      });

      if (existing) {
        if (currentAppId && existing.appId === currentAppId) {
          return { isDuplicate: false, type: 'licensePlate' };
        }

        return {
          isDuplicate: true,
          type: 'licensePlate',
          existingApp: existing.appId || 'principal',
          existingUser: existing.user?.fullName || 'Usuário desconhecido',
          registeredAt: existing.createdAt
        };
      }

      return { isDuplicate: false, type: 'licensePlate' };
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao validar placa:", error);
      return { isDuplicate: false, type: 'licensePlate' };
    }
  }

  /**
   * Registra um novo usuário no banco central (se configurado)
   */
  async registerUser(userData: {
    cpf: string;
    phone: string;
    email: string;
    fullName: string;
    appId: string;
  }): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      // Por enquanto, apenas logamos o registro
      // Em produção, isso seria uma chamada API para o banco central
      console.log(`[CENTRAL_DB] Registro de usuário solicitado: ${userData.email} (App: ${userData.appId})`);
      return true;
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao registrar usuário:", error);
      return false;
    }
  }

  /**
   * Registra uma nova indicação/placa no banco central (se configurado)
   */
  async registerReferral(referralData: {
    licensePlate: string;
    phone: string;
    userId: number;
    appId: string;
  }): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      // Por enquanto, apenas logamos o registro
      // Em produção, isso seria uma chamada API para o banco central
      console.log(`[CENTRAL_DB] Registro de placa solicitado: ${referralData.licensePlate} (App: ${referralData.appId})`);
      return true;
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao registrar placa:", error);
      return false;
    }
  }

  /**
   * Busca estatísticas de duplicidade entre aplicativos
   */
  async getDuplicateStats(appId: string): Promise<{
    totalDuplicateCPFs: number;
    totalDuplicatePhones: number;
    totalDuplicatePlates: number;
  }> {
    if (!this.isReady()) {
      return {
        totalDuplicateCPFs: 0,
        totalDuplicatePhones: 0,
        totalDuplicatePlates: 0
      };
    }

    try {
      // Implementar queries para contar duplicatas
      // Por ora, retornamos valores zerados
      return {
        totalDuplicateCPFs: 0,
        totalDuplicatePhones: 0,
        totalDuplicatePlates: 0
      };
    } catch (error) {
      console.error("[CENTRAL_DB] Erro ao buscar estatísticas:", error);
      return {
        totalDuplicateCPFs: 0,
        totalDuplicatePhones: 0,
        totalDuplicatePlates: 0
      };
    }
  }
}

// Exportar instância única do validador
export const centralValidator = new CentralDatabaseValidator();

// Função helper para obter ID do aplicativo atual
export function getCurrentAppId(): string {
  // O ID do app pode vir de variáveis de ambiente ou ser gerado
  return process.env.APP_ID || process.env.REPL_SLUG || 'app-principal';
}