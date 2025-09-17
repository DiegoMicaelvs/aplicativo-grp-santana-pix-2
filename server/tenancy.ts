/**
 * Sistema de resolução de tenant para identificar empresa por webapp
 * Distingue entre Kong Pix e Grupo Santana Pix automaticamente
 */

import type { Request, Response, NextFunction } from "express";

// Configuração dos tenants
export interface TenantConfig {
  tenant: 'kongpix' | 'gruposantana';
  companyId: number;
  companyName: string;
}

// Mapeamento estático dos tenants
const TENANT_CONFIG: Record<string, TenantConfig> = {
  kongpix: {
    tenant: 'kongpix',
    companyId: 11, // Kong Pix company ID
    companyName: 'Kong Pix'
  },
  gruposantana: {
    tenant: 'gruposantana', 
    companyId: 1, // Grupo Santana Pix company ID
    companyName: 'Grupo Santana Pix'
  }
};

/**
 * Resolve o tenant atual baseado em variáveis de ambiente e host
 */
export function resolveTenant(req?: Request): TenantConfig {
  // 1. Prioridade: variável de ambiente APP_TENANT
  const envTenant = process.env.APP_TENANT;
  if (envTenant && envTenant in TENANT_CONFIG) {
    return TENANT_CONFIG[envTenant];
  }

  // 2. Fallback: APP_ID ou REPL_SLUG (heurística)
  const appId = process.env.APP_ID || process.env.REPL_SLUG || '';
  if (appId.toLowerCase().includes('kong')) {
    return TENANT_CONFIG.kongpix;
  }
  if (appId.toLowerCase().includes('santana') || appId.toLowerCase().includes('grupo')) {
    return TENANT_CONFIG.gruposantana;
  }

  // 3. Fallback: headers do host (se request disponível)
  if (req?.headers.host) {
    const host = req.headers.host.toLowerCase();
    if (host.includes('kong')) {
      return TENANT_CONFIG.kongpix;
    }
    if (host.includes('santana') || host.includes('grupo')) {
      return TENANT_CONFIG.gruposantana;
    }
  }

  // 4. Default: Grupo Santana
  return TENANT_CONFIG.gruposantana;
}

/**
 * Middleware Express para anexar informações do tenant na request
 */
export function attachTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantConfig = resolveTenant(req);
  
  // Anexar ao request para uso nos handlers
  (req as any).tenant = tenantConfig;
  
  // Anexar ao res.locals para templates/views se necessário
  res.locals.tenant = tenantConfig;
  
  next();
}

/**
 * Obtém configuração do tenant atual
 */
export function getCurrentTenant(req: Request): TenantConfig {
  return (req as any).tenant || resolveTenant(req);
}

/**
 * Verifica se é tenant Kong Pix
 */
export function isKongPix(req: Request): boolean {
  return getCurrentTenant(req).tenant === 'kongpix';
}

/**
 * Verifica se é tenant Grupo Santana
 */
export function isGrupoSantana(req: Request): boolean {
  return getCurrentTenant(req).tenant === 'gruposantana';
}

/**
 * Obtém company ID do tenant atual
 */
export function getTenantCompanyId(req: Request): number {
  return getCurrentTenant(req).companyId;
}