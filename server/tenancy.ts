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
 * Resolve o tenant atual.
 *
 * O tenant define a EMPRESA a que as indicações de não-admins são atribuídas
 * — ou seja, decide de quem é a comissão. Por isso ele NÃO pode depender de
 * nada que o cliente controle.
 *
 * A versão anterior, quando APP_TENANT não estava definido, caía no header
 * `Host` da requisição para escolher a empresa. Como o `Host` é enviado pelo
 * cliente, dava para forçar leads na empresa errada só trocando o cabeçalho.
 * Esse fallback foi removido.
 *
 * Agora vem só de APP_TENANT (ou da heurística por APP_ID/REPL_SLUG do
 * ambiente, que também não é controlada pelo cliente). Em produção sem tenant
 * resolvido, o boot falha (ver assertTenantConfigured).
 */
export function resolveTenant(_req?: Request): TenantConfig {
  // 1. Prioridade: variável de ambiente APP_TENANT
  const envTenant = process.env.APP_TENANT;
  if (envTenant && envTenant in TENANT_CONFIG) {
    return TENANT_CONFIG[envTenant];
  }

  // 2. Heurística por identificador do AMBIENTE (não vem do cliente)
  const appId = process.env.APP_ID || process.env.REPL_SLUG || '';
  if (appId.toLowerCase().includes('kong')) {
    return TENANT_CONFIG.kongpix;
  }
  if (appId.toLowerCase().includes('santana') || appId.toLowerCase().includes('grupo')) {
    return TENANT_CONFIG.gruposantana;
  }

  // 3. Default de desenvolvimento (em produção o boot já teria falhado)
  return TENANT_CONFIG.gruposantana;
}

/**
 * Chamada no boot: em produção, exige que o tenant venha de configuração
 * explícita do ambiente. Sem isso, todas as indicações cairiam no default
 * silenciosamente — e a decisão de qual empresa paga a comissão não pode ser
 * um acaso de configuração.
 */
export function assertTenantConfigured(): void {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) return;

  const envTenant = process.env.APP_TENANT;
  const appId = process.env.APP_ID || process.env.REPL_SLUG || '';
  const temTenantExplicito =
    (envTenant && envTenant in TENANT_CONFIG) ||
    /kong|santana|grupo/i.test(appId);

  if (!temTenantExplicito) {
    throw new Error(
      "APP_TENANT é obrigatório em produção (valores: 'kongpix' ou 'gruposantana'). " +
        "Sem ele, a empresa das indicações cairia num default silencioso.",
    );
  }
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