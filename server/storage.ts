import { db } from "@db";
import { eq, desc, asc, or, count, and, sql, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { 
  users, 
  referrals, 
  referralPlates,
  referralLinks,
  companies,
  companySettings,
  withdrawalRequests,
  cashFlow,
  supportTickets,
  ticketResponses,
  auditLog,
  referralConversations,
  salesLeads,
  salesActivities,
  salesReminders,
  type InsertUser,
  type CreateUserInput,
  type CreateReferral, 
  type ReferralStatus,
  type WithdrawalStatus,
  type Company,
  type CreateWithdrawalRequest,
  type CreateSupportTicket,
  type CreateTicketResponse,
  type CreateCashFlow,
  type CreateReferralConversation,
  type SalesLead,
  type CreateSalesLead,
  type UpdateSalesLead,
  type SalesActivity,
  type CreateSalesActivity,
  type SalesReminder,
  type CreateSalesReminder,
  type AnalystPermission,
  type ManagerPermission,
  type CreateReferralPlate,
  type ReferralLink,
  type CreateReferralLink,
  type UpdateReferralLink
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

// Create session store
const PostgresSessionStore = connectPg(session);

/**
 * Chave fixa do advisory lock que serializa a escrita do livro caixa.
 * Qualquer número constante serve; só precisa não colidir com outro lock
 * do mesmo banco.
 */
const CASH_FLOW_LOCK_KEY = 918273645;

/** Teto do rateio por lead: R$3+R$1 no validado, R$50+R$10 no convertido. */
export const POOL_VALIDATED = 4;
export const POOL_CONVERTED = 60;

/**
 * Normaliza e limita um valor de comissão vindo de qualquer rota.
 * Devolve null quando não houver valor — nunca NaN, nunca acima do pool,
 * nunca negativo.
 */
/**
 * Reparte um pool de comissão entre indicador, supervisor e promotor.
 *
 * Invariantes garantidas:
 *  - nenhuma parcela é negativa;
 *  - a soma das três parcelas é EXATAMENTE o pool.
 *
 * O cálculo anterior fazia `alocaçãoSupervisor - takeIndicador` direto, o que
 * fica negativo quando o promotor aloca ao supervisor menos do que o indicador
 * já leva. Parcela negativa vira débito no saldo de quem não devia nada.
 *
 * @param alocacaoSupervisor quanto do pool o promotor reservou para o
 *   supervisor. `null` = indicador não tem supervisor (ou não há alocação
 *   definida); nesse caso o promotor fica com todo o resto.
 */
export function repartirPool(
  pool: number,
  takeIndicador: number,
  alocacaoSupervisor: number | null,
): { indicador: number; supervisor: number; promotor: number } {
  // O indicador nunca leva menos que zero nem mais que o pool inteiro.
  const indicador = Math.min(Math.max(takeIndicador, 0), pool);

  if (alocacaoSupervisor === null) {
    return { indicador, supervisor: 0, promotor: pool - indicador };
  }

  // A alocação precisa cobrir o que o indicador leva e caber dentro do pool.
  const alocacao = Math.min(Math.max(alocacaoSupervisor, indicador), pool);

  return {
    indicador,
    supervisor: alocacao - indicador,
    promotor: pool - alocacao,
  };
}

export function clampComissao(valor: unknown, teto: number): string | null {
  if (valor === undefined || valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).trim());
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), teto).toFixed(2);
}

/** Saldo insuficiente detectado no débito atômico do saque. */
export class InsufficientBalanceError extends Error {
  constructor() {
    super("Saldo insuficiente");
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Outra requisição já mudou o status desta indicação entre a nossa leitura e a
 * nossa escrita. Serve para desfazer a transação sem creditar comissão.
 */
export class ConcurrentStatusChangeError extends Error {
  constructor(public readonly referralId: number) {
    super("Esta indicação foi atualizada por outra requisição. Recarregue e tente novamente.");
    this.name = "ConcurrentStatusChangeError";
  }
}

/**
 * Tentativa de excluir fisicamente um usuário que tem histórico financeiro.
 * Apagar destruiria a trilha de auditoria de dinheiro; o correto é desativar.
 */
export class UserHasFinancialHistoryError extends Error {
  constructor() {
    super(
      "Usuário possui histórico financeiro (comissões, saques ou caixa) e não pode ser excluído. Desative a conta em vez de excluir.",
    );
    this.name = "UserHasFinancialHistoryError";
  }
}

export interface IStorage {
  // User methods
  createUser(user: CreateUserInput): Promise<any>;
  getUserById(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getUserByCpf(cpf: string): Promise<any>;
  getAllUsers(): Promise<any[]>;
  getUsersByRole(role: string): Promise<any[]>;
  getUsersByCreator(creatorId: number): Promise<any[]>;
  getIndicadoresByPromoter(promoterId: number): Promise<any[]>;
  getSupervisorsByPromoter(promoterId: number): Promise<any[]>;
  getIndicadoresBySupervisor(supervisorId: number): Promise<any[]>;
  updateUserBalance(userId: number, amount: number): Promise<void>;
  updateUserPermissions(userId: number, permissions: string[], analystLevel?: number): Promise<any>;
  updateUserProfile(userId: number, updates: any): Promise<any>;
  updateUserStatus(userId: number, isActive: boolean): Promise<any>;
  resetUserPassword(userId: number): Promise<string>;
  deleteUser(userId: number): Promise<void>;
  
  // Sales CRM methods
  createSalesLead(leadData: CreateSalesLead, vendedorId: number): Promise<SalesLead>;
  getSalesLeadsByVendedor(vendedorId: number): Promise<any[]>;
  getSalesLeadById(leadId: number, vendedorId: number): Promise<any>;
  updateSalesLead(leadId: number, vendedorId: number, updates: UpdateSalesLead): Promise<SalesLead>;
  createSalesActivity(activityData: CreateSalesActivity & { leadId: number, vendedorId: number }): Promise<SalesActivity>;
  getSalesActivitiesByLead(leadId: number, vendedorId: number): Promise<SalesActivity[]>;
  createSalesReminder(reminderData: CreateSalesReminder & { leadId: number, vendedorId: number }): Promise<SalesReminder>;
  getSalesRemindersByVendedor(vendedorId: number): Promise<any[]>;
  completeSalesReminder(reminderId: number, vendedorId: number): Promise<SalesReminder>;
  convertReferralToLead(referralId: number, vendedorId: number): Promise<SalesLead>;
  getSalesStats(vendedorId: number): Promise<any>;
  
  // Referral methods
  createReferral(referral: CreateReferral & { userId: number; plates?: string[] }): Promise<any>;
  getReferralById(id: number): Promise<any>;
  getAllReferralsForMetisViewer(): Promise<any[]>;
  getReferralsByUserId(userId: number): Promise<any[]>;
  getReferralsByUserIdPaginated(userId: number, page?: number, limit?: number, status?: string, search?: string): Promise<{ data: any[], total: number, page: number, limit: number, totalPages: number }>;
  getReferralsByCreatorPaginated(creatorId: number, page?: number, limit?: number, status?: string, search?: string): Promise<{ data: any[], total: number, page: number, limit: number, totalPages: number }>;
  getReferralsByUsers(userIds: number[]): Promise<any[]>;
  getAllReferrals(): Promise<any[]>;
  getReferralsByStatus(status: ReferralStatus): Promise<any[]>;
  checkDuplicateReferral(phone?: string, licensePlate?: string, fullName?: string): Promise<any[]>;
  checkDuplicateReferralWithOwner(phone?: string, licensePlate?: string, fullName?: string): Promise<any[]>;
  getTodayReferralsByUserId(userId: number, startDate: Date): Promise<any[]>;
  updateReferralStatus(id: number, status: ReferralStatus, notes?: string, adminUserId?: number): Promise<any>;
  calculateCommissions(referralId: number): Promise<void>;
  
  // Multiple license plates methods - DISABLED (table doesn't exist)
  // addPlateToReferral(referralId: number, plate: string, isPrimary?: boolean): Promise<any>;
  // removePlateFromReferral(referralId: number, plateId: number): Promise<void>;
  // getReferralPlates(referralId: number): Promise<any[]>;
  // updatePlatePrimary(referralId: number, plateId: number): Promise<void>;
  checkDuplicatePlate(plate: string): Promise<any[]>;
  getReferralsByCompanyId(companyId: number): Promise<any[]>;
  
  // Company methods
  getAllCompanies(): Promise<Company[]>;
  getCompanyById(id: number): Promise<Company | undefined>;
  getCompanyByToken(token: string): Promise<Company | undefined>;
  createCompany(name: string): Promise<Company>;
  
  // Withdrawal methods
  createWithdrawalRequest(request: CreateWithdrawalRequest & { userId: number }): Promise<any>;
  getWithdrawalRequestsByUserId(userId: number): Promise<any[]>;
  getAllWithdrawalRequests(): Promise<any[]>;
  updateWithdrawalStatus(id: number, status: WithdrawalStatus, processedBy: number, notes?: string): Promise<any>;
  updateWithdrawalInsurance(id: number, hasInsurance: boolean): Promise<any>;
  
  // Cash flow methods
  createCashFlowEntry(entry: CreateCashFlow & { createdBy: number }): Promise<any>;
  getCashFlowEntries(): Promise<any[]>;
  getCurrentBalance(): Promise<number>;
  
  // Support ticket methods
  createSupportTicket(userId: number, ticketData: CreateSupportTicket): Promise<any>;
  getSupportTicketsByUserId(userId: number): Promise<any[]>;
  getAllSupportTickets(): Promise<any[]>;
  getSupportTicketById(id: number): Promise<any>;
  updateTicketStatus(id: number, status: string): Promise<any>;
  createTicketResponse(response: CreateTicketResponse): Promise<any>;
  
  // Audit trail methods
  logUserAction(action: {
    userId: number;
    action: string;
    entityType: string;
    entityId?: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    details?: string;
  }): Promise<void>;
  
  // Promoter management methods
  transferReferralsToPromoter(indicadorId: number, promoterId: number | null): Promise<void>;
  getAuditLog(filters?: { userId?: number; entityType?: string; fromDate?: Date; toDate?: Date }): Promise<any[]>;
  
  // Team-based access methods
  getReferralsByTeam(promoterId: number): Promise<any[]>;
  getUserTeamStats(userId: number): Promise<{ totalReferrals: number; convertedReferrals: number; totalCommissions: number }>;
  validateCpfForWithdrawal(userId: number, cpfKey: string): Promise<boolean>;
  generateTicketNumber(): Promise<string>;
  
  // Admin stats with efficient aggregations
  getAdminStats(): Promise<{ totalIndicadores: number; totalReferrals: number; pendingReferrals: number; convertedReferrals: number; conversionRate: string }>;
  
  // Referral Link methods
  createReferralLink(userId: number, data: CreateReferralLink): Promise<ReferralLink>;
  getReferralLinksByUserId(userId: number): Promise<ReferralLink[]>;
  getReferralLinkById(id: number): Promise<ReferralLink | null>;
  updateReferralLink(id: number, userId: number, data: UpdateReferralLink): Promise<ReferralLink>;
  deleteReferralLink(id: number, userId: number): Promise<void>;
  trackReferralLinkClick(token: string): Promise<void>;
  createUserWithReferralAttribution(userData: CreateUserInput, referralToken?: string): Promise<any>;
  
  // Session store
  sessionStore: session.Store;
}

class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      tableName: 'session',
      createTableIfMissing: true 
    });
  }
  
  // User methods
  /**
   * @param executor transação em curso. Quando chamado de dentro de um
   *   db.transaction, PRECISA receber o `tx`: usar a conexão global aqui pega
   *   uma segunda conexão do pool enquanto a primeira segue presa pela
   *   transação aberta. Sob carga isso esgota o pool e, pior, o INSERT fica
   *   fora da transação — um rollback não desfaz o usuário criado.
   */
  async createUser(userData: CreateUserInput, executor: any = db) {
    try {
      // Prepare user data with proper typing
      // Normalizar username e email - use email as username if username not provided
      if (!userData || (!userData.username && !userData.email)) {
        throw new Error("Username or email is required");
      }
      
      const normalizedUsername = (userData.username || userData.email).trim().toLowerCase();
      const normalizedEmail = (userData.email || userData.username).trim().toLowerCase();
      
      console.log(`[STORAGE] Criando usuário com username normalizado: ${normalizedUsername}`);
      console.log(`[STORAGE] Dados recebidos:`, {
        role: userData.role,
        createdBy: userData.createdBy,
        promoterId: userData.promoterId,
        analystId: userData.analystId,
        supervisorId: userData.supervisorId
      });

      // Import hashPassword function
      const { hashPassword } = await import('./auth');
      
      // Hash the password before storing
      const hashedPassword = await hashPassword(userData.password);
      
      const insertData = {
        username: normalizedUsername,
        password: hashedPassword,
        fullName: userData.fullName,
        email: normalizedEmail,
        phone: userData.phone,
        cpf: userData.cpf,
        address: `${userData.city}, ${userData.state} - ${userData.zipCode}`, // Construct address from parts
        city: userData.city,
        state: userData.state,
        zipCode: userData.zipCode,
        shirtSize: userData.shirtSize,
        pixKey: userData.pixKey,
        role: (userData.role || "indicador") as "indicador" | "promotor" | "admin" | "analista" | "gerente" | "vendedor",
        permissions: userData.permissions ? userData.permissions as (AnalystPermission[] | ManagerPermission[]) : null,
        analystLevel: userData.analystLevel as 1 | 2 | 3 | null,
        createdBy: userData.createdBy || null,
        promoterId: userData.promoterId || null,
        analystId: userData.analystId || null,
        supervisorId: userData.supervisorId || null,
        teamSupervisorId: (userData as any).teamSupervisorId || null,
        /**
         * Último portão das comissões: rotas diferentes validavam (ou não) o
         * teto do pool cada uma do seu jeito. Aqui, no único ponto por onde
         * todo usuário é criado, o valor é normalizado e limitado — nenhuma
         * rota consegue gravar comissão fora da faixa nem um NaN.
         */
        commissionValidated: clampComissao((userData as any).commissionValidated, POOL_VALIDATED),
        commissionConverted: clampComissao((userData as any).commissionConverted, POOL_CONVERTED),
        balance: "0",
        totalEarnings: "0",
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [user] = await executor.insert(users)
        .values([insertData])
        .returning();

      // Se é um analista, garantir que tenha as permissões corretas
      if (user.role === 'analista') {
        const { ensureAnalystPermissions } = await import('../scripts/ensure-analyst-permissions');
        await ensureAnalystPermissions(user.id);
        
        // Buscar o usuário atualizado com as permissões
        const updatedUser = await db.query.users.findFirst({
          where: eq(users.id, user.id)
        });
        
        if (updatedUser) {
          return updatedUser;
        }
      }
      
      return user;
    } catch (error) {
      console.error('[STORAGE] Erro ao criar usuário:', error);
      throw error;
    }
  }
  
  async getUserById(id: number) {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }
  
  async getUserByUsername(username: string) {
    // Normalizar username: remover espaços e converter para minúsculas
    const normalizedUsername = username.trim().toLowerCase();
    
    // Buscar usuário com case-insensitive
    const user = await db.query.users.findFirst({
      where: sql`LOWER(${users.username}) = ${normalizedUsername}`
    });
    
    if (!user) {
      console.log(`[AUTH] Usuário não encontrado: ${normalizedUsername}`);
    } else {
      console.log(`[AUTH] Usuário encontrado: ${user.username} (${user.fullName})`);
    }
    
    return user;
  }
  
  async getUserByCpf(cpf: string) {
    return await db.query.users.findFirst({
      where: eq(users.cpf, cpf)
    });
  }
  
  async getAllUsers() {
    // Nunca traz o hash da senha do banco. O único ponto que precisa dele é a
    // LocalStrategy do passport, que usa getUserByUsername.
    return await db.query.users.findMany({
      columns: { password: false },
      orderBy: desc(users.createdAt)
    });
  }
  
  async getUsersByRole(role: string) {
    return await db.query.users.findMany({
      where: eq(users.role, role as any),
      orderBy: desc(users.createdAt)
    });
  }
  
  async getUsersByCreator(creatorId: number) {
    return await db.query.users.findMany({
      where: eq(users.createdBy, creatorId),
      orderBy: desc(users.createdAt)
    });
  }
  
  async getIndicadoresByPromoter(promoterId: number) {
    return await db.query.users.findMany({
      where: eq(users.promoterId, promoterId),
      orderBy: desc(users.createdAt)
    });
  }

  async getSupervisorsByPromoter(promoterId: number) {
    return await db.query.users.findMany({
      where: and(eq(users.promoterId, promoterId), eq(users.role, 'supervisor')),
      orderBy: desc(users.createdAt)
    });
  }

  async getIndicadoresBySupervisor(supervisorId: number) {
    return await db.query.users.findMany({
      where: eq(users.teamSupervisorId, supervisorId),
      orderBy: desc(users.createdAt)
    });
  }

  async getUsersBySupervisor(supervisorId: number) {
    return await db.query.users.findMany({
      where: eq(users.supervisorId, supervisorId),
      orderBy: desc(users.createdAt)
    });
  }

  async getAllUsersBySupervisor(supervisorId: number) {
    console.log(`[getAllUsersBySupervisor] Fetching users for supervisor ID: ${supervisorId}`);
    
    // Get all users directly supervised by this analyst
    const directlySupervisedUsers = await db.query.users.findMany({
      where: eq(users.supervisorId, supervisorId),
      orderBy: desc(users.createdAt)
    });

    console.log(`[getAllUsersBySupervisor] Found ${directlySupervisedUsers.length} directly supervised users`);

    // Get all promoters supervised by this analyst
    const supervisedPromoters = directlySupervisedUsers.filter(u => u.role === 'promotor');
    const promoterIds = supervisedPromoters.map(p => p.id);
    
    console.log(`[getAllUsersBySupervisor] Found ${supervisedPromoters.length} supervised promoters with IDs:`, promoterIds);

    // Get all indicators assigned to those promoters
    let indicatorsFromPromoters: any[] = [];
    if (promoterIds.length > 0) {
      const promoterConditions = promoterIds.map(id => eq(users.promoterId, id));
      indicatorsFromPromoters = await db.query.users.findMany({
        where: or(...promoterConditions),
        orderBy: desc(users.createdAt)
      });
    }
    
    console.log(`[getAllUsersBySupervisor] Found ${indicatorsFromPromoters.length} indicators from promoters`);

    // Combine both lists and remove duplicates
    const allUsers = [...directlySupervisedUsers];
    indicatorsFromPromoters.forEach(indicator => {
      if (!allUsers.find(u => u.id === indicator.id)) {
        allUsers.push(indicator);
      }
    });

    console.log(`[getAllUsersBySupervisor] Returning total of ${allUsers.length} users`);
    
    return allUsers;
  }

  // Get unique users who created referrals for Metis da Pix company only
  async getUsersWithMetisReferrals() {
    const metisReferrals = await db.query.referrals.findMany({
      where: eq(referrals.companyId, 5), // Metis da Pix company ID
      with: {
        user: true
      }
    });

    // Extract unique users
    const uniqueUsers = new Map();
    metisReferrals.forEach(referral => {
      if (referral.user && !uniqueUsers.has(referral.user.id)) {
        uniqueUsers.set(referral.user.id, referral.user);
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Get stats specifically for Metis da Pix company
  async getMetisViewerStats() {
    const metisReferrals = await db.query.referrals.findMany({
      where: eq(referrals.companyId, 5), // Metis da Pix company ID
      with: {
        user: true
      }
    });

    const totalReferrals = metisReferrals.length;
    const statusCounts = metisReferrals.reduce((acc, ref) => {
      acc[ref.status] = (acc[ref.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueUsers = new Set(metisReferrals.map(r => r.userId));
    const totalUsers = uniqueUsers.size;

    return {
      totalReferrals,
      totalUsers,
      statusCounts,
      companyName: "Metis",
      companyId: 5
    };
  }

  // Get admin stats with efficient SQL aggregations - OPTIMIZED
  async getAdminStats() {
    // Count indicadores using SQL aggregation
    const indicadoresResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'indicador'));
    const totalIndicadores = indicadoresResult[0]?.count || 0;

    // Count total referrals
    const totalReferralsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals);
    const totalReferrals = totalReferralsResult[0]?.count || 0;

    // Count pending referrals
    const pendingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(eq(referrals.status, 'pending'));
    const pendingReferrals = pendingResult[0]?.count || 0;

    // Count validated referrals (for conversion rate calculation)
    const validatedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(eq(referrals.status, 'validated'));
    const validatedReferrals = validatedResult[0]?.count || 0;

    // Count converted/paid referrals
    const convertedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(or(eq(referrals.status, 'converted'), eq(referrals.status, 'paid')));
    const convertedReferrals = convertedResult[0]?.count || 0;

    // Calculate conversion rate
    const conversionRate = validatedReferrals > 0 
      ? (convertedReferrals / validatedReferrals * 100).toFixed(1) 
      : "0";

    return {
      totalIndicadores,
      totalReferrals,
      pendingReferrals,
      convertedReferrals,
      conversionRate
    };
  }
  
  /**
   * @param executor transação em curso, quando o crédito precisa ser desfeito
   *                 junto com o resto da operação. Sem ele usa a conexão normal.
   */
  async updateUserBalance(
    userId: number,
    amount: number,
    updateEarnings: boolean = false,
    executor: any = db,
  ) {
    try {
      console.log(`[updateUserBalance] Atualizando saldo do usuário ${userId} com valor: ${amount}, updateEarnings: ${updateEarnings}`);

      // REGRA DE NEGÓCIO CORRIGIDA:
      // - balance: saldo disponível para saque (comissões pendentes)
      // - totalEarnings: valor total já pago ao usuário (apenas saques pagos)
      // Por padrão, apenas atualiza o saldo disponível
      // O totalEarnings só é atualizado quando updateEarnings=true (quando saque é pago)
      if (updateEarnings) {
        await executor.update(users)
          .set({
            balance: sql`balance + ${amount}`,
            totalEarnings: sql`total_earnings + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      } else {
        await executor.update(users)
          .set({
            balance: sql`balance + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }

      // Não relemos o usuário aqui: dentro de transação a leitura pela conexão
      // normal enxergaria o valor antigo, e era uma consulta extra por crédito
      // em todo caminho quente.
    } catch (error) {
      console.error(`[updateUserBalance] Erro ao atualizar saldo do usuário ${userId}:`, error);
      throw error;
    }
  }

  async updateUserTotalEarnings(userId: number, amount: number) {
    try {
      console.log(`[updateUserTotalEarnings] Atualizando total de ganhos do usuário ${userId} com valor: ${amount}`);
      
      await db.update(users)
        .set({ 
          totalEarnings: sql`total_earnings + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      const updatedUser = await this.getUserById(userId);
      if (updatedUser) {
        console.log(`[updateUserTotalEarnings] Novo total de ganhos: ${updatedUser.totalEarnings}`);
      }
    } catch (error) {
      console.error(`[updateUserTotalEarnings] Erro ao atualizar total de ganhos do usuário ${userId}:`, error);
      throw error;
    }
  }
  
  async updateUserPermissions(userId: number, permissions: string[], analystLevel?: number) {
    const updateData: any = {
      permissions,
      updatedAt: new Date()
    };
    
    if (analystLevel !== undefined) {
      updateData.analystLevel = analystLevel;
    }
    
    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async updateUserProfile(userId: number, updates: any) {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.balance;
    delete updateData.totalEarnings;

    // If city, state, or zipCode are being updated, reconstruct the address field
    if (updateData.city || updateData.state || updateData.zipCode) {
      // Get current user data to fill in any missing parts
      const currentUser = await this.getUserById(userId);
      if (currentUser) {
        const city = updateData.city || currentUser.city || '';
        const state = updateData.state || currentUser.state || '';
        const zipCode = updateData.zipCode || currentUser.zipCode || '';
        
        // Reconstruct address in the expected format
        updateData.address = `${city}, ${state} - ${zipCode}`;
      }
    }

    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async updateUserStatus(userId: number, isActive: boolean) {
    const [updatedUser] = await db.update(users)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async assignIndicatorToPromoter(userId: number, promoterId: number | null) {
    const [updatedUser] = await db.update(users)
      .set({ 
        promoterId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }
  
  async assignUserToSupervisor(userId: number, supervisorId: number | null) {
    const [updatedUser] = await db.update(users)
      .set({ 
        supervisorId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async assignIndicator(userId: number, promoterId: number | null, supervisorId: number | null) {
    // Clear both fields first, then set the appropriate one
    const updateData: any = {
      promoterId: null,
      supervisorId: null,
      updatedAt: new Date()
    };
    
    // Set the appropriate field
    if (promoterId) {
      updateData.promoterId = promoterId;
    } else if (supervisorId) {
      updateData.supervisorId = supervisorId;
    }
    
    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async resetUserPassword(userId: number, customPassword?: string) {
    // Use custom password if provided, otherwise generate one
    const newPassword = customPassword || Array.from({length: 10}, () => 
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
    
    // Import the hashPassword function from auth module
    const { hashPassword } = await import('./auth');
    const hashedPassword = await hashPassword(newPassword);
    
    const [updatedUser] = await db.update(users)
      .set({ 
        password: hashedPassword,
        mustChangePassword: true, // Force password change on next login
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return newPassword; // Return the plain text password for display
  }

  /**
   * Exclusão FÍSICA de usuário.
   *
   * A versão anterior deletava `referrals` do usuário sem tocar em quem os
   * referencia — `cash_flow.related_referral_id`, `sales_leads.referral_id`,
   * `referral_conversations` de terceiros — e ignorava os campos de OUTRAS
   * indicações/usuários que apontam para este (promoterId, supervisorId,
   * validatedBy...). Com qualquer histórico, o DELETE final batia numa FK e a
   * operação inteira falhava com 500.
   *
   * Regra deste sistema: se o usuário tem HISTÓRICO FINANCEIRO (indicação com
   * comissão, saque, ou lançamento de caixa), a exclusão física é recusada.
   * Apagar isso destruiria a trilha de auditoria de dinheiro. Nesse caso o
   * caminho é desativar (isActive=false), que já bloqueia login e uso.
   *
   * Só quando o usuário está "limpo" (sem dinheiro no histórico) a exclusão
   * prossegue, e mesmo assim tratando todas as dependências em ordem.
   */
  async deleteUser(userId: number) {
    await db.transaction(async (tx) => {
      /**
       * Barreira: existe histórico financeiro?
       *
       * O sinal MAIS forte é o próprio saldo do usuário. balance e
       * totalEarnings resumem dinheiro devido e dinheiro já pago — cobrem
       * inclusive comissão de promotor/supervisor recebida em indicações de
       * TERCEIROS, que não aparece em referrals.userId. Sem isso, um promotor
       * com saldo a receber mas sem indicação própria seria apagado e o saldo
       * sumiria.
       */
      const [usuario] = await tx
        .select({ balance: users.balance, totalEarnings: users.totalEarnings })
        .from(users)
        .where(eq(users.id, userId));

      const temSaldo =
        parseFloat(usuario?.balance ?? "0") > 0 || parseFloat(usuario?.totalEarnings ?? "0") > 0;

      // Comissão em QUALQUER parcela (indicador, promotor ou supervisor) numa
      // indicação onde este usuário participa como dono, promotor ou supervisor.
      const [comComissao] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(referrals)
        .where(
          and(
            or(
              eq(referrals.userId, userId),
              eq(referrals.promoterId, userId),
              eq(referrals.supervisorId, userId),
            ),
            sql`(${referrals.commissionIndicator}::numeric > 0
              OR ${referrals.commissionPromoter}::numeric > 0
              OR ${referrals.commissionSupervisor}::numeric > 0)`,
          ),
        );

      const [comSaque] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.userId, userId));

      const [comCaixa] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(cashFlow)
        .where(eq(cashFlow.createdBy, userId));

      if (temSaldo || (comComissao?.n ?? 0) > 0 || (comSaque?.n ?? 0) > 0 || (comCaixa?.n ?? 0) > 0) {
        throw new UserHasFinancialHistoryError();
      }

      /**
       * Indicações a apagar: apenas as que pertencem de fato ao usuário
       * (userId). Uma indicação que ele apenas CRIOU para outra pessoa
       * (createdBy=ele, userId=outro) é o registro de comissão de OUTRO
       * indicador — apagá-la destruiria o histórico que gerou o saldo alheio.
       * Nessas, o vínculo createdBy é anulado mais abaixo, não deletado.
       */
      const indicacoes = await tx
        .select({ id: referrals.id })
        .from(referrals)
        .where(eq(referrals.userId, userId));
      const referralIds = indicacoes.map((r) => r.id);

      // Leads de venda onde este usuário é o vendedor (para limpar atividades/lembretes)
      const leads = await tx
        .select({ id: salesLeads.id })
        .from(salesLeads)
        .where(eq(salesLeads.vendedorId, userId));
      const leadIds = leads.map((l) => l.id);

      // --- Dependentes das indicações do usuário ---
      if (referralIds.length > 0) {
        await tx.delete(cashFlow).where(inArray(cashFlow.relatedReferralId, referralIds));
        await tx.delete(referralConversations).where(inArray(referralConversations.referralId, referralIds));
        await tx.delete(salesLeads).where(inArray(salesLeads.referralId, referralIds));
        // referral_plates cai por cascade ao deletar a indicação
      }

      // --- Dependentes dos leads de venda do usuário ---
      if (leadIds.length > 0) {
        await tx.delete(salesActivities).where(inArray(salesActivities.leadId, leadIds));
        await tx.delete(salesReminders).where(inArray(salesReminders.leadId, leadIds));
      }
      await tx.delete(salesLeads).where(eq(salesLeads.vendedorId, userId));
      await tx.delete(salesActivities).where(eq(salesActivities.vendedorId, userId));
      await tx.delete(salesReminders).where(eq(salesReminders.vendedorId, userId));

      // --- Histórico direto do usuário ---
      await tx.delete(ticketResponses).where(eq(ticketResponses.userId, userId));
      await tx.delete(supportTickets).where(eq(supportTickets.userId, userId));
      await tx.delete(referralConversations).where(eq(referralConversations.userId, userId));
      await tx.delete(auditLog).where(eq(auditLog.userId, userId));
      await tx.delete(referralLinks).where(eq(referralLinks.userId, userId));

      // Sem histórico financeiro, mas ainda pode haver saques recusados/retidos
      await tx.delete(withdrawalRequests).where(eq(withdrawalRequests.userId, userId));

      // As indicações do usuário
      if (referralIds.length > 0) {
        await tx.delete(referrals).where(inArray(referrals.id, referralIds));
      }

      // --- Referências de OUTRAS indicações a este usuário ---
      // Indicações que ele criou para terceiros (createdBy=ele, userId=outro)
      // NÃO foram deletadas acima. createdBy é NOT NULL, então reatribuímos ao
      // próprio dono da indicação, preservando o registro de comissão alheio.
      await tx
        .update(referrals)
        .set({ createdBy: sql`${referrals.userId}` })
        .where(and(eq(referrals.createdBy, userId), sql`${referrals.userId} <> ${userId}`));

      // Os demais vínculos são anuláveis
      await tx.update(referrals).set({ promoterId: null }).where(eq(referrals.promoterId, userId));
      await tx.update(referrals).set({ supervisorId: null }).where(eq(referrals.supervisorId, userId));
      await tx.update(referrals).set({ validatedBy: null }).where(eq(referrals.validatedBy, userId));
      await tx.update(referrals).set({ paymentProofUploadedBy: null }).where(eq(referrals.paymentProofUploadedBy, userId));
      await tx.update(referrals).set({ contactStatusUpdatedBy: null }).where(eq(referrals.contactStatusUpdatedBy, userId));
      await tx.update(referrals).set({ indicatorPaymentStatusUpdatedBy: null }).where(eq(referrals.indicatorPaymentStatusUpdatedBy, userId));

      // --- Vínculos hierárquicos em OUTROS usuários ---
      await tx.update(users).set({ promoterId: null }).where(eq(users.promoterId, userId));
      await tx.update(users).set({ createdBy: null }).where(eq(users.createdBy, userId));
      await tx.update(users).set({ analystId: null }).where(eq(users.analystId, userId));
      await tx.update(users).set({ supervisorId: null }).where(eq(users.supervisorId, userId));
      await tx.update(users).set({ teamSupervisorId: null }).where(eq(users.teamSupervisorId, userId));

      // Saques processados por este usuário (o registro fica, o processador some)
      await tx.update(withdrawalRequests).set({ processedBy: null }).where(eq(withdrawalRequests.processedBy, userId));

      await tx.delete(users).where(eq(users.id, userId));
    });
  }
  
  // Referral methods
  async createReferral(referralData: CreateReferral & { userId: number; createdBy: number; promoterId?: number; plates?: string[] }) {
    // Get user info to determine promoter
    const user = await this.getUserById(referralData.userId);
    const promoterId = referralData.promoterId || user?.promoterId || null;
    
    // Get plates from either the new licensePlates array or the legacy plates parameter  
    const platesToCreate = referralData.plates || referralData.licensePlates || [];
    const primaryPlate = platesToCreate[0];
    
    // Destructure referralData to exclude licensePlates field (not in database table)
    const { licensePlates, plates, ...referralDataForDB } = referralData;
    
    // Get creator user name
    const creator = await this.getUserById(referralData.createdBy);
    const creatorName = creator?.fullName || creator?.username || 'Usuário';
    
    const [referral] = await db.insert(referrals)
      .values({
        ...referralDataForDB,
        licensePlate: primaryPlate, // Keep backward compatibility
        promoterId,
        statusHistory: [{
          status: 'pending',
          changedBy: referralData.createdBy,
          changedByName: creatorName,
          changedAt: new Date().toISOString(),
          notes: 'Indicação criada'
        }]
      })
      .returning();
    
    // Log audit trail (with error handling)
    try {
      await this.logUserAction({
        userId: referralData.createdBy,
        action: 'create',
        entityType: 'referral',
        entityId: referral.id,
        newValues: referral,
        details: `Nova indicação criada: ${referralData.fullName}`
      });
    } catch (error) {
      console.warn('Failed to log user action:', error);
      // Don't fail the referral creation if audit logging fails
    }
    
    return referral;
  }
  
  async getReferralById(id: number) {
    return await db.query.referrals.findFirst({
      where: eq(referrals.id, id),
      with: {
        user: true,
        company: true
      }
    });
  }

  // Multiple license plates methods - DISABLED (table doesn't exist in database)
  // async addPlateToReferral(referralId: number, plate: string, isPrimary: boolean = false) {
  //   const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  //   
  //   // If this is set as primary, update other plates to not be primary
  //   if (isPrimary) {
  //     await db.update(referralPlates)
  //       .set({ isPrimary: false })
  //       .where(eq(referralPlates.referralId, referralId));
  //   }
  //   
  //   const [newPlate] = await db.insert(referralPlates)
  //     .values({
  //       referralId,
  //       plate: normalizedPlate,
  //       isPrimary
  //     })
  //     .returning();
  //   
  //   return newPlate;
  // }

  // async removePlateFromReferral(referralId: number, plateId: number) {
  //   await db.delete(referralPlates)
  //     .where(and(
  //       eq(referralPlates.id, plateId),
  //       eq(referralPlates.referralId, referralId)
  //     ));
  // }

  // async getReferralPlates(referralId: number) {
  //   return await db.query.referralPlates.findMany({
  //     where: eq(referralPlates.referralId, referralId),
  //     orderBy: [desc(referralPlates.isPrimary), asc(referralPlates.createdAt)]
  //   });
  // }

  // async updatePlatePrimary(referralId: number, plateId: number) {
  //   // First, set all plates for this referral to not primary
  //   await db.update(referralPlates)
  //     .set({ isPrimary: false })
  //     .where(eq(referralPlates.referralId, referralId));
  //   
  //   // Then set the selected plate as primary
  //   await db.update(referralPlates)
  //     .set({ isPrimary: true })
  //     .where(and(
  //       eq(referralPlates.id, plateId),
  //       eq(referralPlates.referralId, referralId)
  //     ));
  //   
  //   // Update the main referrals table licensePlate field for backward compatibility
  //   const primaryPlate = await db.query.referralPlates.findFirst({
  //     where: and(
  //       eq(referralPlates.id, plateId),
  //       eq(referralPlates.referralId, referralId)
  //     )
  //   });
  //   
  //   if (primaryPlate) {
  //     await db.update(referrals)
  //       .set({ licensePlate: primaryPlate.plate })
  //       .where(eq(referrals.id, referralId));
  //   }
  // }

  async checkDuplicatePlate(plate: string) {
    const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Check only referrals.licensePlate
    const referralResults = await db.query.referrals.findMany({
      where: sql`UPPER(REPLACE(${referrals.licensePlate}, '-', '')) = ${normalizedPlate}`,
      with: {
        user: true
      }
    });
    
    return referralResults;
  }
  
  async getReferralsByUserId(userId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.userId, userId),
      with: {
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }

  async getReferralsByUserIdPaginated(userId: number, page: number = 1, limit: number = 10, status?: string, search?: string) {
    // Guard against invalid pagination parameters
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit); // No limit cap - allow fetching all referrals
    const offset = (safePage - 1) * safeLimit;
    
    // Build where conditions
    const conditions: any[] = [eq(referrals.userId, userId)];
    
    if (status) {
      conditions.push(eq(referrals.status, status as ReferralStatus));
    }
    
    // Add search condition
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${referrals.fullName}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.phone}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.licensePlate}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.city}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.state}) LIKE ${searchTerm}`
        )
      );
    }
    
    const whereCondition = and(...conditions);
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(whereCondition);
    const total = totalResult[0]?.count || 0;
    
    // Get paginated data
    const data = await db.query.referrals.findMany({
      where: whereCondition,
      with: {
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt),
      limit: safeLimit,
      offset
    });
    
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    };
  }

  /**
   * Paginação do analista feita no BANCO.
   *
   * A rota carregava getAllReferrals() — a tabela inteira, com joins — e só
   * então filtrava e fatiava em JavaScript. Cada troca de página relia tudo.
   * Com o volume de um dia de evento (milhares de leads), isso é o primeiro
   * ponto a derreter: memória do processo, tempo de resposta e conexões presas.
   *
   * @param restringirAUsuarios analista nível 3 só enxerga a própria equipe.
   *   Lista vazia significa "nenhum resultado"; undefined significa "todos".
   */
  async getReferralsPaginatedForAnalyst(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    restringirAUsuarios?: number[],
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const offset = (safePage - 1) * safeLimit;

    if (restringirAUsuarios && restringirAUsuarios.length === 0) {
      return { data: [], total: 0, page: safePage, limit: safeLimit, totalPages: 0 };
    }

    const conditions: any[] = [];

    if (restringirAUsuarios) {
      conditions.push(inArray(referrals.userId, restringirAUsuarios));
    }

    if (status) {
      conditions.push(eq(referrals.status, status as ReferralStatus));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${referrals.fullName}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.phone}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.licensePlate}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.city}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.state}) LIKE ${searchTerm}`
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(whereCondition);
    const total = totalResult[0]?.count || 0;

    const data = await db.query.referrals.findMany({
      where: whereCondition,
      with: {
        company: true,
        user: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt),
      limit: safeLimit,
      offset
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    };
  }

  /**
   * Métricas públicas da empresa agregadas NO BANCO.
   *
   * A rota carregava todas as indicações da empresa (e uma segunda vez no ramo
   * mensal) só para contar e somar em JavaScript. É endpoint público, sem
   * autenticação: bastava recarregar a página para o servidor trazer a tabela
   * inteira de novo. Agora são três agregações que não trafegam linha alguma.
   *
   * A data considerada varia por status — a mesma regra que existia no filtro
   * em memória: validated usa validatedAt, converted/paid usam updatedAt, o
   * resto usa createdAt.
   */
  async getCompanyPublicMetrics(
    companyId: number,
    periodo?: { inicio: Date; fim: Date },
  ) {
    const dataDoStatus = sql`CASE
      WHEN ${referrals.status} = 'validated' AND ${referrals.validatedAt} IS NOT NULL THEN ${referrals.validatedAt}
      WHEN ${referrals.status} IN ('converted','paid') AND ${referrals.updatedAt} IS NOT NULL THEN ${referrals.updatedAt}
      ELSE ${referrals.createdAt}
    END`;

    const filtroEmpresa = eq(referrals.companyId, companyId);
    const filtroPeriodo = periodo
      ? and(
          filtroEmpresa,
          sql`${dataDoStatus} >= ${periodo.inicio.toISOString()}`,
          sql`${dataDoStatus} <= ${periodo.fim.toISOString()}`,
        )
      : filtroEmpresa;

    const [contagens] = await db
      .select({
        total: sql<number>`count(*)::int`,
        convertidas: sql<number>`count(*) FILTER (WHERE ${referrals.status} IN ('converted','paid'))::int`,
        pendentes: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'pending')::int`,
        analisando: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'analyzing')::int`,
        validadas: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'validated')::int`,
        rejeitadas: sql<number>`count(*) FILTER (WHERE ${referrals.status} IN ('rejected','false','not_converted'))::int`,
        indicadores: sql<number>`count(DISTINCT ${referrals.userId})::int`,
        promotores: sql<number>`count(DISTINCT ${referrals.promoterId})::int`,
        comissaoIndicadores: sql<number>`COALESCE(SUM(${referrals.commissionIndicator}) FILTER (WHERE ${referrals.status} IN ('validated','converted','paid')), 0)::float`,
        comissaoPromotores: sql<number>`COALESCE(SUM(${referrals.commissionPromoter}) FILTER (WHERE ${referrals.status} IN ('validated','converted','paid')), 0)::float`,
      })
      .from(referrals)
      .where(filtroPeriodo);

    // Janela fixa de 30 dias, sempre sobre createdAt (independe do filtro de mês)
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const [recentes] = await db
      .select({
        recentes: sql<number>`count(*)::int`,
        indicadoresAtivos: sql<number>`count(DISTINCT ${referrals.userId})::int`,
      })
      .from(referrals)
      .where(
        and(filtroEmpresa, sql`${referrals.createdAt} >= ${trintaDiasAtras.toISOString()}`),
      );

    // No recorte mensal as comissões são contadas por EVENTO ocorrido no mês
    // (validação e conversão), não pelo acumulado da indicação.
    let comissaoIndicadores = contagens?.comissaoIndicadores ?? 0;
    let comissaoPromotores = contagens?.comissaoPromotores ?? 0;

    if (periodo) {
      const [eventos] = await db
        .select({
          validadasNoMes: sql<number>`count(*) FILTER (WHERE ${referrals.validatedAt} >= ${periodo.inicio.toISOString()} AND ${referrals.validatedAt} <= ${periodo.fim.toISOString()})::int`,
          convertidasNoMes: sql<number>`count(*) FILTER (WHERE ${referrals.status} IN ('converted','paid') AND ${referrals.updatedAt} >= ${periodo.inicio.toISOString()} AND ${referrals.updatedAt} <= ${periodo.fim.toISOString()})::int`,
        })
        .from(referrals)
        .where(filtroEmpresa);

      const validadas = eventos?.validadasNoMes ?? 0;
      const convertidas = eventos?.convertidasNoMes ?? 0;
      comissaoIndicadores = validadas * 3 + convertidas * 50;
      comissaoPromotores = validadas * 1 + convertidas * 10;
    }

    return {
      total: contagens?.total ?? 0,
      convertidas: contagens?.convertidas ?? 0,
      pendentes: contagens?.pendentes ?? 0,
      analisando: contagens?.analisando ?? 0,
      validadas: contagens?.validadas ?? 0,
      rejeitadas: contagens?.rejeitadas ?? 0,
      indicadores: contagens?.indicadores ?? 0,
      promotores: contagens?.promotores ?? 0,
      comissaoIndicadores,
      comissaoPromotores,
      recentes: recentes?.recentes ?? 0,
      indicadoresAtivos: recentes?.indicadoresAtivos ?? 0,
    };
  }

  async getReferralsByCreator(creatorId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.createdBy, creatorId),
      with: {
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }
  
  async getReferralsByCreatorPaginated(creatorId: number, page: number = 1, limit: number = 10, status?: string, search?: string) {
    // Guard against invalid pagination parameters
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit); // No limit cap - allow fetching all referrals
    const offset = (safePage - 1) * safeLimit;
    
    // Build where conditions
    const conditions: any[] = [eq(referrals.createdBy, creatorId)];
    
    if (status) {
      conditions.push(eq(referrals.status, status as ReferralStatus));
    }
    
    // Add search condition
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${referrals.fullName}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.phone}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.licensePlate}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.city}) LIKE ${searchTerm}`,
          sql`LOWER(${referrals.state}) LIKE ${searchTerm}`
        )
      );
    }
    
    const whereCondition = and(...conditions);
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(whereCondition);
    const total = totalResult[0]?.count || 0;
    
    // Get paginated data
    const data = await db.query.referrals.findMany({
      where: whereCondition,
      with: {
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt),
      limit: safeLimit,
      offset
    });
    
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    };
  }
  
  async getReferralsByUsers(userIds: number[]) {
    if (userIds.length === 0) return [];
    
    return await db.query.referrals.findMany({
      where: or(...userIds.map(id => eq(referrals.userId, id))),
      with: {
        user: true,
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }
  
  /**
   * Quantas indicações existem num período (ou no total). Usado pela
   * exportação para recusar antes de montar uma planilha gigante.
   */
  async countReferrals(periodo?: { inicio: Date; fim: Date }): Promise<number> {
    const where = periodo
      ? and(
          sql`${referrals.createdAt} >= ${periodo.inicio.toISOString()}`,
          sql`${referrals.createdAt} <= ${periodo.fim.toISOString()}`,
        )
      : undefined;
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(referrals)
      .where(where);
    return row?.n ?? 0;
  }

  /** Indicações de um período, para exportação (com teto de linhas). */
  async getReferralsForExport(periodo: { inicio: Date; fim: Date } | undefined, limite: number) {
    const where = periodo
      ? and(
          sql`${referrals.createdAt} >= ${periodo.inicio.toISOString()}`,
          sql`${referrals.createdAt} <= ${periodo.fim.toISOString()}`,
        )
      : undefined;
    return db.query.referrals.findMany({
      where,
      orderBy: desc(referrals.createdAt),
      limit: limite,
    });
  }

  /** Nomes de usuários por id, para resolver rótulos sem carregar a base toda. */
  async getUserNamesByIds(ids: number[]): Promise<Map<number, string>> {
    const mapa = new Map<number, string>();
    const unicos = Array.from(new Set(ids.filter((id) => Number.isInteger(id))));
    if (unicos.length === 0) return mapa;

    const linhas = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, unicos));

    for (const l of linhas) mapa.set(l.id, l.fullName);
    return mapa;
  }

  async getAllReferrals() {
    // OPTIMIZED: Use explicit JOIN instead of 'with' to avoid N+1 queries
    const userAlias = sql`"user"`.as('user');
    const createdByAlias = sql`"createdByUser"`.as('createdByUser');
    
    const results = await db
      .select({
        id: referrals.id,
        userId: referrals.userId,
        createdBy: referrals.createdBy,
        companyId: referrals.companyId,
        fullName: referrals.fullName,
        phone: referrals.phone,
        city: referrals.city,
        state: referrals.state,
        licensePlate: referrals.licensePlate,
        hasInsurance: referrals.hasInsurance,
        status: referrals.status,
        notes: referrals.notes,
        vehicleBrand: referrals.vehicleBrand,
        vehicleModel: referrals.vehicleModel,
        vehicleYear: referrals.vehicleYear,
        commissionIndicator: referrals.commissionIndicator,
        commissionPromoter: referrals.commissionPromoter,
        statusHistory: referrals.statusHistory,
        createdAt: referrals.createdAt,
        updatedAt: referrals.updatedAt,
        validatedBy: referrals.validatedBy,
        validatedAt: referrals.validatedAt,
        nameCorrect: referrals.nameCorrect,
        plateCorrect: referrals.plateCorrect,
        phoneCorrect: referrals.phoneCorrect,
        validationNotes: referrals.validationNotes,
        paymentProof: referrals.paymentProof,
        promoterId: referrals.promoterId,
        contactStatus: referrals.contactStatus,
        contactStatusUpdatedAt: referrals.contactStatusUpdatedAt,
        contactStatusUpdatedBy: referrals.contactStatusUpdatedBy,
        // User relation
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          cpf: users.cpf,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          balance: users.balance,
          totalEarnings: users.totalEarnings,
          promoterId: users.promoterId,
          supervisorId: users.supervisorId,
          createdBy: users.createdBy,
          permissions: users.permissions,
          analystLevel: users.analystLevel,
          state: users.state,
          city: users.city,
          createdAt: users.createdAt
        },
        // Company relation  
        company: {
          id: companies.id,
          name: companies.name,
          isActive: companies.isActive,
          createdAt: companies.createdAt
        }
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.userId, users.id))
      .leftJoin(companies, eq(referrals.companyId, companies.id))
      .orderBy(desc(referrals.createdAt));

    return results;
  }

  async getAllReferralsPaginated(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    
    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(referrals);
    const total = Number(totalResult[0].count);
    
    // Get paginated results
    const results = await db
      .select({
        id: referrals.id,
        userId: referrals.userId,
        createdBy: referrals.createdBy,
        companyId: referrals.companyId,
        fullName: referrals.fullName,
        phone: referrals.phone,
        city: referrals.city,
        state: referrals.state,
        licensePlate: referrals.licensePlate,
        hasInsurance: referrals.hasInsurance,
        status: referrals.status,
        notes: referrals.notes,
        vehicleBrand: referrals.vehicleBrand,
        vehicleModel: referrals.vehicleModel,
        vehicleYear: referrals.vehicleYear,
        commissionIndicator: referrals.commissionIndicator,
        commissionPromoter: referrals.commissionPromoter,
        statusHistory: referrals.statusHistory,
        createdAt: referrals.createdAt,
        updatedAt: referrals.updatedAt,
        validatedBy: referrals.validatedBy,
        validatedAt: referrals.validatedAt,
        nameCorrect: referrals.nameCorrect,
        plateCorrect: referrals.plateCorrect,
        phoneCorrect: referrals.phoneCorrect,
        validationNotes: referrals.validationNotes,
        paymentProof: referrals.paymentProof,
        promoterId: referrals.promoterId,
        contactStatus: referrals.contactStatus,
        contactStatusUpdatedAt: referrals.contactStatusUpdatedAt,
        contactStatusUpdatedBy: referrals.contactStatusUpdatedBy,
        // User relation
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          cpf: users.cpf,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          balance: users.balance,
          totalEarnings: users.totalEarnings,
          promoterId: users.promoterId,
          supervisorId: users.supervisorId,
          createdBy: users.createdBy,
          permissions: users.permissions,
          analystLevel: users.analystLevel,
          state: users.state,
          city: users.city,
          createdAt: users.createdAt
        },
        // Company relation  
        company: {
          id: companies.id,
          name: companies.name,
          isActive: companies.isActive,
          createdAt: companies.createdAt
        }
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.userId, users.id))
      .leftJoin(companies, eq(referrals.companyId, companies.id))
      .orderBy(desc(referrals.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getReferralsByCompanyId(companyId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.companyId, companyId),
      with: {
        user: true,
        promoter: true,
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }

  // Get all referrals only from Metis da Pix company (ID: 5)
  async getAllReferralsForMetisViewer() {
    return await db.query.referrals.findMany({
      where: eq(referrals.companyId, 5), // Filter only Metis da Pix company
      with: {
        user: true,
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }

  async getReferralsBySupervisor(supervisorId: number) {
    // Get all users currently under supervision
    const allUsers = await this.getAllUsersBySupervisor(supervisorId);
    const userIds = allUsers.map(u => u.id);
    
    if (userIds.length === 0) {
      return [];
    }
    
    // Get referrals where userId is one of the supervised users
    // This ensures we only see referrals assigned to currently supervised users
    const userIdConditions = userIds.map(id => eq(referrals.userId, id));
    
    const result = await db.query.referrals.findMany({
      where: or(...userIdConditions),
      with: {
        user: true,
        company: true,
        createdByUser: true
      },
      orderBy: desc(referrals.createdAt)
    });
    
    return result;
  }
  
  async getReferralsByStatus(status: ReferralStatus) {
    return await db.query.referrals.findMany({
      where: eq(referrals.status, status),
      with: {
        user: true,
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }
  
  async checkDuplicateReferral(phone?: string, licensePlate?: string) {
    const conditions = [];
    // Use case-insensitive comparison with LOWER() SQL function
    if (phone) conditions.push(sql`LOWER(${referrals.phone}) = LOWER(${phone})`);
    if (licensePlate) conditions.push(sql`LOWER(${referrals.licensePlate}) = LOWER(${licensePlate})`);
    
    if (conditions.length === 0) return [];
    
    // Search in main referrals table
    const referralResults = await db.query.referrals.findMany({
      where: or(...conditions),
      with: {
        user: true
      }
    });
    
    return referralResults;
  }

  async checkDuplicateReferralWithOwner(phone?: string, licensePlate?: string) {
    const conditions = [];
    // Use case-insensitive comparison with LOWER() SQL function
    if (phone) conditions.push(sql`LOWER(${referrals.phone}) = LOWER(${phone})`);
    if (licensePlate) conditions.push(sql`LOWER(${referrals.licensePlate}) = LOWER(${licensePlate})`);
    
    if (conditions.length === 0) return [];
    
    // OPTIMIZED: Removed slow SPLIT_PART SQL function - frontend can split if needed
    const referralResults = await db.select({
      id: referrals.id,
      fullName: referrals.fullName,
      phone: referrals.phone,
      licensePlate: referrals.licensePlate,
      createdAt: referrals.createdAt,
      createdByName: users.fullName,
      createdByState: users.state
    }).from(referrals)
      .leftJoin(users, eq(referrals.createdBy, users.id))
      .where(or(...conditions))
      .orderBy(asc(referrals.createdAt));
    
    return referralResults;
  }

  async getTodayReferralsByUserId(userId: number, startDate: Date) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    return await db.query.referrals.findMany({
      where: and(
        eq(referrals.userId, userId),
        sql`${referrals.createdAt} >= ${startDate.toISOString()}`,
        sql`${referrals.createdAt} < ${endDate.toISOString()}`
      )
    });
  }
  
  async calculateCommissions(referralId: number) {
    // Commission calculation is handled inside updateReferralStatus method
    // This method is here just to satisfy the interface requirement
    console.log(`[calculateCommissions] Called for referral ${referralId} - commissions are calculated in updateReferralStatus`);
  }
  
  async updateReferralStatus(id: number, status: ReferralStatus, notes?: string, adminUserId?: number, paymentProof?: string, adminUserName?: string) {
    try {
      console.log(`[updateReferralStatus] Starting update for referral ${id} to status ${status}`);
      
      const referral = await this.getReferralById(id);
      if (!referral) {
        throw new Error("Referral not found");
      }
      
      const previousStatus = referral.status;
      const previousCommissionIndicator = parseFloat(referral.commissionIndicator?.toString() || '0');
      const previousCommissionPromoter = parseFloat(referral.commissionPromoter?.toString() || '0');
      
      console.log(`[updateReferralStatus] Previous status: ${previousStatus}, commissions: indicator=${previousCommissionIndicator}, promoter=${previousCommissionPromoter}`);
      
      // Get user name if not provided
      let changedByName = adminUserName;
      if (!changedByName && adminUserId) {
        const adminUser = await this.getUserById(adminUserId);
        changedByName = adminUser?.fullName || adminUser?.username || 'Usuário';
      }
      
      // Nova entrada de histórico (anexada atomicamente no UPDATE, ver adiante)
      const newHistoryEntry = {
        status,
        changedBy: adminUserId || 0,
        changedByName: changedByName || 'Sistema',
        changedAt: new Date().toISOString(),
        notes: notes || ''
      };
      
      // Get user to check their role and custom commissions
      const user = await this.getUserById(referral.userId);

      // --- Custom commission split logic ---
      // Total pools: validated = R$4, converted bonus = R$60
      const POOL_VALIDATED = 4;
      const POOL_CONVERTED = 60;

      // Determine indicador's custom commission (if set, else default)
      const indicadorCustomValidated = user?.commissionValidated ? parseFloat(user.commissionValidated.toString()) : null;
      const indicadorCustomConverted = user?.commissionConverted ? parseFloat(user.commissionConverted.toString()) : null;

      // Check if indicador has a team supervisor
      let supervisorUser: any = null;
      if (user?.teamSupervisorId) {
        supervisorUser = await this.getUserById(user.teamSupervisorId);
      }

      // Supervisor's allocation (what promotor gave the supervisor)
      const supervisorAllocValidated = supervisorUser?.commissionValidated ? parseFloat(supervisorUser.commissionValidated.toString()) : null;
      const supervisorAllocConverted = supervisorUser?.commissionConverted ? parseFloat(supervisorUser.commissionConverted.toString()) : null;

      // Compute effective commissions based on status
      let newCommissionIndicator = 0;
      let newCommissionPromoter = 0;
      let newCommissionSupervisor = 0;

      const previousCommissionSupervisor = parseFloat((referral as any).commissionSupervisor?.toString() || '0');

      /**
       * Rateio ABSOLUTO.
       *
       * Dois defeitos foram corrigidos aqui:
       *
       * 1. O ramo 'converted' era INCREMENTAL: só somava o bônus quando
       *    previousStatus === 'validated'. Vindo de qualquer outro estado ele
       *    gravava apenas o bônus (R$50) e PERDIA a parcela do validado (R$3).
       *    Consequência prática: remarcar 'converted' uma segunda vez caía no
       *    ramo do else (o anterior já era 'converted'), gravava 53 -> 50 e
       *    DEBITAVA R$3 do indicador. E pending -> converted direto pagava
       *    R$50 em vez de R$53.
       *
       *    Agora 'converted' é sempre validado + bônus, calculado do zero.
       *    O valor final não depende do caminho percorrido nem de quantas
       *    vezes a transição foi aplicada.
       *
       * 2. `alocaçãoSupervisor - takeIndicador` podia ser NEGATIVO. Com o
       *    supervisor alocado em R$2 e o indicador levando R$3, o supervisor
       *    era debitado em R$1 por um lead da própria equipe.
       *
       *    repartirPool() garante parcela não-negativa e soma exatamente igual
       *    ao pool.
       */
      const alocValidadoEfetiva =
        supervisorUser && supervisorAllocValidated !== null ? supervisorAllocValidated : null;
      const alocConvertidoEfetiva =
        supervisorUser && supervisorAllocConverted !== null ? supervisorAllocConverted : null;

      const rateioValidado = repartirPool(
        POOL_VALIDATED,
        indicadorCustomValidated !== null ? indicadorCustomValidated : 3,
        alocValidadoEfetiva,
      );

      const rateioBonusConversao = repartirPool(
        POOL_CONVERTED,
        indicadorCustomConverted !== null ? indicadorCustomConverted : 50,
        alocConvertidoEfetiva,
      );

      if (status === 'validated') {
        newCommissionIndicator = rateioValidado.indicador;
        newCommissionSupervisor = rateioValidado.supervisor;
        newCommissionPromoter = rateioValidado.promotor;
      } else if (status === 'converted') {
        // Convertido = o que já valia pelo validado + o bônus de conversão.
        newCommissionIndicator = rateioValidado.indicador + rateioBonusConversao.indicador;
        newCommissionSupervisor = rateioValidado.supervisor + rateioBonusConversao.supervisor;
        newCommissionPromoter = rateioValidado.promotor + rateioBonusConversao.promotor;
      } else if (status === 'paid') {
        newCommissionIndicator = previousCommissionIndicator;
        newCommissionPromoter = previousCommissionPromoter;
        newCommissionSupervisor = previousCommissionSupervisor;
      }
      // For other statuses (pending, rejected, analyzing) commissions are zero

      console.log(`[updateReferralStatus] New commissions: indicator=${newCommissionIndicator}, supervisor=${newCommissionSupervisor}, promoter=${newCommissionPromoter}`);

      // Special rule: indicador_nivel_1 users don't receive commissions - their commissions go to the promoter
      // This ONLY applies to indicators whose promoter is Marcelo Macedo or Wescley Gondim
      const specialPromoterEmails = ['marcelomacedo@gmail.com', 'wescleygondim@yahoo.com.br'];
      let isSpecialPromoterIndicator = false;
      
      if (user?.role === 'indicador_nivel_1' && user?.promoterId) {
        const promoter = await this.getUserById(user.promoterId);
        isSpecialPromoterIndicator = specialPromoterEmails.includes(promoter?.username?.toLowerCase() || '');
      }
      
      let finalCommissionIndicator = newCommissionIndicator;
      let finalCommissionPromoter = newCommissionPromoter;
      let finalCommissionSupervisor = newCommissionSupervisor;
      
      if (isSpecialPromoterIndicator) {
        // Transfer indicator commission to promoter
        finalCommissionPromoter = newCommissionIndicator + newCommissionPromoter;
        finalCommissionIndicator = 0;
        finalCommissionSupervisor = 0;
        console.log(`[updateReferralStatus] indicador_nivel_1 with special promoter detected - redirecting commissions to promoter: indicator=0, promoter=${finalCommissionPromoter}`);
      }
      
      // Recalculate previous commissions for special promoter indicators (they were already redirected)
      let prevIndicatorCommission = previousCommissionIndicator;
      let prevPromoterCommission = previousCommissionPromoter;
      let prevSupervisorCommission = previousCommissionSupervisor;
      if (isSpecialPromoterIndicator) {
        prevIndicatorCommission = 0;
        prevPromoterCommission = previousCommissionIndicator + previousCommissionPromoter;
        prevSupervisorCommission = 0;
      }
      
      // Calculate the difference in commissions
      const commissionDifferenceIndicator = finalCommissionIndicator - prevIndicatorCommission;
      const commissionDifferencePromoter = finalCommissionPromoter - prevPromoterCommission;
      const commissionDifferenceSupervisor = finalCommissionSupervisor - prevSupervisorCommission;
      
      console.log(`[updateReferralStatus] Commission differences: indicator=${commissionDifferenceIndicator}, supervisor=${commissionDifferenceSupervisor}, promoter=${commissionDifferencePromoter}`);
      
      // Os créditos foram movidos para DEPOIS da reivindicação da transição
      // (ver o db.transaction mais abaixo). Creditar antes de garantir que esta
      // requisição é a dona da mudança de status era o que permitia pagar a
      // mesma indicação duas vezes num duplo clique.

      // REMOVIDO: Não atualizar totalEarnings quando indicação é paga
      // O totalEarnings deve ser atualizado apenas quando um SAQUE é pago, não quando uma indicação é paga
      
      // Concatenate notes with timestamp and author to preserve history
      let updatedNotes = referral.notes || '';
      if (notes && notes.trim()) {
        const timestamp = new Date().toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Get admin user name if available
        let adminName = 'Sistema';
        if (adminUserId) {
          const adminUser = await this.getUserById(adminUserId);
          adminName = adminUser?.fullName || adminUser?.username || `Usuário ${adminUserId}`;
        }
        
        // Append new note with timestamp and author
        const newNoteEntry = `[${timestamp} - ${adminName}] ${notes}`;
        updatedNotes = updatedNotes 
          ? `${updatedNotes}\n\n${newNoteEntry}`
          : newNoteEntry;
      }
      
      // Prepare update data - use final commission values (adjusted for indicador_nivel_1)
      const updateData: any = {
        status,
        notes: updatedNotes,
        commissionIndicator: finalCommissionIndicator.toFixed(2),
        commissionPromoter: finalCommissionPromoter.toFixed(2),
        commissionSupervisor: finalCommissionSupervisor.toFixed(2),
        supervisorId: supervisorUser?.id || (referral as any).supervisorId || null,
        // Append atômico: concatena no banco em vez de reescrever o array lido.
        // Sem isto, um PATCH de contact-status concorrente (que também anexa ao
        // statusHistory) teria a entrada dele sobrescrita por este UPDATE.
        statusHistory: sql`COALESCE(${referrals.statusHistory}, '[]'::jsonb) || ${JSON.stringify([newHistoryEntry])}::jsonb`,
        updatedAt: new Date()
      };
      
      // Update validatedAt and validatedBy when status changes to validated
      if (status === 'validated' && previousStatus !== 'validated') {
        updateData.validatedAt = new Date();
        if (adminUserId) {
          updateData.validatedBy = adminUserId;
        }
      }
      
      // Add payment proof if provided
      if (paymentProof) {
        updateData.paymentProof = paymentProof;
        updateData.paymentProofUploadedAt = new Date();
        updateData.paymentProofUploadedBy = adminUserId;
      }
      
      /**
       * Transição atômica + crédito das comissões.
       *
       * O UPDATE é CONDICIONAL: só altera a linha se ela ainda estiver no
       * status que lemos no início. Quem perder a corrida não atualiza linha
       * nenhuma, a transação inteira é desfeita e nenhum saldo é tocado.
       *
       * Antes, os saldos eram creditados ANTES deste UPDATE e fora de
       * transação. Como updateUserBalance usa `balance + X` (incremento
       * atômico), dois PATCH simultâneos SOMAVAM os créditos: R$8 de comissão
       * para um lead de R$4, ou R$100 num lead convertido de R$50 — enquanto a
       * indicação registrava o valor uma única vez. Um duplo clique do analista
       * bastava.
       */
      const updatedReferral = await db.transaction(async (tx) => {
        const [claimed] = await tx.update(referrals)
          .set(updateData)
          .where(
            and(
              eq(referrals.id, id),
              // guarda de estado: ninguém mudou o status desde a nossa leitura
              eq(referrals.status, previousStatus),
            ),
          )
          .returning();

        if (!claimed) {
          throw new ConcurrentStatusChangeError(id);
        }

        // Só agora, com a transição garantida, o dinheiro se move.
        if (isSpecialPromoterIndicator) {
          // Special promoter indicator: Only update promoter balance (indicator gets nothing)
          if (user?.promoterId && commissionDifferencePromoter !== 0) {
            await this.updateUserBalance(user.promoterId, commissionDifferencePromoter, false, tx);
            console.log(`[updateReferralStatus] Updated promoter balance for special promoter ${user.promoterId}: ${commissionDifferencePromoter > 0 ? '+' : ''}${commissionDifferencePromoter} (includes indicator commission)`);
          }
        } else {
          // Normal flow: update indicator, supervisor and promoter separately
          if (user && commissionDifferenceIndicator !== 0) {
            await this.updateUserBalance(user.id, commissionDifferenceIndicator, false, tx);
            console.log(`[updateReferralStatus] Updated indicator balance for user ${user.id}: ${commissionDifferenceIndicator > 0 ? '+' : ''}${commissionDifferenceIndicator}`);
          }

          // Update supervisor balance if exists
          if (supervisorUser && commissionDifferenceSupervisor !== 0) {
            await this.updateUserBalance(supervisorUser.id, commissionDifferenceSupervisor, false, tx);
            console.log(`[updateReferralStatus] Updated supervisor balance for user ${supervisorUser.id}: ${commissionDifferenceSupervisor > 0 ? '+' : ''}${commissionDifferenceSupervisor}`);
          }

          // Update promoter balance if exists
          if (user?.promoterId && commissionDifferencePromoter !== 0) {
            await this.updateUserBalance(user.promoterId, commissionDifferencePromoter, false, tx);
            console.log(`[updateReferralStatus] Updated promoter balance for user ${user.promoterId}: ${commissionDifferencePromoter > 0 ? '+' : ''}${commissionDifferencePromoter}`);
          }
        }

        return claimed;
      });

      console.log(`[updateReferralStatus] Referral updated successfully`);
      console.log(`[updateReferralStatus] PaymentProof saved:`, updatedReferral.paymentProof ? `Yes (${updatedReferral.paymentProof.length} chars)` : 'No');
      
      // Log audit trail (with error handling)
      if (adminUserId) {
        try {
          await this.logUserAction({
            userId: adminUserId,
            action: 'update',
            entityType: 'referral',
            entityId: id,
            oldValues: { 
              status: previousStatus, 
              commissionIndicator: previousCommissionIndicator,
              commissionPromoter: previousCommissionPromoter 
            },
            newValues: { 
              status, 
              commissionIndicator: finalCommissionIndicator,
              commissionPromoter: finalCommissionPromoter 
            },
            details: `Status alterado de ${previousStatus} para ${status}${commissionDifferenceIndicator < 0 ? ' (comissões revertidas)' : ''}${notes ? `: ${notes}` : ''}`
          });
        } catch (error) {
          console.warn('Failed to log status update:', error);
          // Don't fail the status update if audit logging fails
        }
      }
      
      // Bloqueio automático por fraude: só avalia quando a indicação ACABOU de
      // virar "false" (falso), para não recontar em atualizações repetidas.
      if (status === 'false' && previousStatus !== 'false') {
        await this.enforceFraudBlock(referral.userId, adminUserId);
      }

      return updatedReferral;
    } catch (error) {
      console.error(`[updateReferralStatus] Error updating referral ${id}:`, error);
      throw error;
    }
  }

  /**
   * Regra antifraude: acima de FRAUD_BLOCK_THRESHOLD indicações marcadas como
   * falsas, o indicador é bloqueado e não consegue mais indicar.
   *
   * O bloqueio reusa `isActive = false`, que é o mesmo mecanismo já aplicado
   * manualmente pelo admin e que barra o login (ver server/auth.ts).
   *
   * Falhas aqui não derrubam a atualização de status da indicação — o analista
   * não pode ficar travado por causa do efeito colateral.
   */
  async enforceFraudBlock(indicadorId: number, actorUserId?: number): Promise<void> {
    const FRAUD_BLOCK_THRESHOLD = 10; // bloqueia ao ULTRAPASSAR 10

    try {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(referrals)
        .where(and(eq(referrals.userId, indicadorId), eq(referrals.status, 'false')));

      const fraudCount = row?.total ?? 0;
      if (fraudCount <= FRAUD_BLOCK_THRESHOLD) return;

      const user = await this.getUserById(indicadorId);
      if (!user || !user.isActive) return; // já bloqueado ou inexistente

      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, indicadorId));

      console.warn(
        `[FRAUDE] Indicador ${indicadorId} (${user.username}) bloqueado automaticamente: ${fraudCount} indicações falsas.`,
      );

      await this.logUserAction({
        userId: actorUserId ?? indicadorId,
        action: 'auto_block_fraud',
        entityType: 'user',
        entityId: indicadorId,
        oldValues: { isActive: true },
        newValues: { isActive: false, fraudCount },
        details:
          `Indicador bloqueado automaticamente por fraude: ${fraudCount} indicações marcadas como falsas ` +
          `(limite: ${FRAUD_BLOCK_THRESHOLD}).`,
      });
    } catch (error) {
      console.error(`[FRAUDE] Falha ao avaliar bloqueio do indicador ${indicadorId}:`, error);
    }
  }

  async validateReferral(id: number, validationData: any, validatorUserId: number) {
    const referral = await this.getReferralById(id);
    if (!referral) {
      throw new Error("Referral not found");
    }

    // Prepare update data
    const updateData: any = {
      vehicleBrand: validationData.vehicleBrand,
      vehicleModel: validationData.vehicleModel,
      vehicleYear: validationData.vehicleYear,
      nameCorrect: validationData.nameCorrect,
      plateCorrect: validationData.plateCorrect,
      phoneCorrect: validationData.phoneCorrect,
      validationNotes: validationData.validationNotes,
      validatedBy: validatorUserId,
      validatedAt: new Date(),
      updatedAt: new Date()
    };

    // If validationNotes is provided, add it to statusHistory
    if (validationData.validationNotes && validationData.validationNotes.trim()) {
      // Get validator user name
      const validator = await this.getUserById(validatorUserId);
      const validatorName = validator?.fullName || validator?.username || 'Usuário';
      const newHistoryEntry = {
        status: referral.status,
        changedBy: validatorUserId,
        changedByName: validatorName,
        changedAt: new Date().toISOString(),
        notes: validationData.validationNotes.trim()
      };
      // Append atômico, como nos outros escritores de statusHistory.
      updateData.statusHistory = sql`COALESCE(${referrals.statusHistory}, '[]'::jsonb) || ${JSON.stringify([newHistoryEntry])}::jsonb`;
    }

    // Update referral with validation data only - DO NOT change status or commissions
    // Status must be changed manually by the user
    const [updatedReferral] = await db.update(referrals)
      .set(updateData)
      .where(eq(referrals.id, id))
      .returning();

    // Log audit trail
    try {
      await this.logUserAction({
        userId: validatorUserId,
        action: 'validate',
        entityType: 'referral',
        entityId: id,
        newValues: validationData,
        details: `Dados de validação salvos: ${validationData.vehicleBrand} ${validationData.vehicleModel} ${validationData.vehicleYear}${validationData.validationNotes ? ` - ${validationData.validationNotes}` : ''}`
      });
    } catch (error) {
      console.warn('Failed to log validation:', error);
    }

    return updatedReferral;
  }
  
  async deleteReferral(id: number) {
    // Delete all related data first
    await db.transaction(async (tx) => {
      // Delete referral conversations
      await tx.delete(referralConversations)
        .where(eq(referralConversations.referralId, id));
      
      // Delete the referral
      await tx.delete(referrals)
        .where(eq(referrals.id, id));
    });
  }
  
  async updateReferral(id: number, updates: any, editorUserId: number) {
    // Get current referral data for audit trail
    const currentReferral = await this.getReferralById(id);
    if (!currentReferral) {
      throw new Error("Indicação não encontrada");
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    // Only include fields that are being updated
    if (updates.fullName !== undefined) updateData.fullName = updates.fullName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.licensePlate !== undefined) updateData.licensePlate = updates.licensePlate;
    if (updates.hasInsurance !== undefined) updateData.hasInsurance = updates.hasInsurance;
    if (updates.companyId !== undefined) updateData.companyId = updates.companyId;
    if (updates.userId !== undefined) updateData.userId = updates.userId;
    if (updates.vehicleBrand !== undefined) updateData.vehicleBrand = updates.vehicleBrand;
    if (updates.vehicleModel !== undefined) updateData.vehicleModel = updates.vehicleModel;
    if (updates.vehicleYear !== undefined) updateData.vehicleYear = updates.vehicleYear;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.commissionIndicator !== undefined) updateData.commissionIndicator = updates.commissionIndicator;
    if (updates.commissionPromoter !== undefined) updateData.commissionPromoter = updates.commissionPromoter;
    if (updates.createdAt !== undefined) updateData.createdAt = updates.createdAt;
    if (updates.paymentProof !== undefined) updateData.paymentProof = updates.paymentProof;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.state !== undefined) updateData.state = updates.state;
    
    // Quanto de comissão precisa migrar junto com a indicação (0 = nada)
    let transferirComissao = 0;

    // Handle user reassignment - transfer commissions and update promoter relationship
    if (updates.userId !== undefined && updates.userId !== currentReferral.userId) {
      console.log(`[updateReferral] Usuário sendo alterado de ${currentReferral.userId} para ${updates.userId}`);
      
      // Get user info for the new assignee to determine their promoter
      const newUser = await this.getUserById(updates.userId);
      const oldUser = await this.getUserById(currentReferral.userId);
      
      console.log(`[updateReferral] Usuário antigo: ${oldUser?.fullName} (ID: ${currentReferral.userId})`);
      console.log(`[updateReferral] Usuário novo: ${newUser?.fullName} (ID: ${updates.userId})`);
      console.log(`[updateReferral] Promotor do novo usuário: ${newUser?.promoterId}`);
      
      // Update promoter relationship for this referral
      if (newUser?.promoterId) {
        updateData.promoterId = newUser.promoterId;
        console.log(`[updateReferral] Atualizando promoterId da indicação para: ${newUser.promoterId}`);
      }
      
      // Check if referral has commissions that need to be transferred
      transferirComissao = parseFloat(currentReferral.commissionIndicator?.toString() || '0');
      if (transferirComissao > 0) {
        console.log(`[updateReferral] Transferindo comissão de ${transferirComissao} do usuário ${currentReferral.userId} para ${updates.userId}`);
      }
      // A comissão do promotor permanece com o promotor original — nada a fazer.
    }

    // Handle status update separately to ensure commission calculations
    if (updates.status !== undefined && updates.status !== currentReferral.status) {
      // Use updateReferralStatus for status changes to handle commissions
      return await this.updateReferralStatus(id, updates.status, updates.notes, editorUserId, updates.paymentProof);
    }

    /**
     * Reatribuição em UMA transação.
     *
     * Eram três escritas soltas: debita o indicador antigo, credita o novo,
     * grava a indicação. Falha entre a primeira e a segunda e o dinheiro
     * simplesmente evapora — saiu de um saldo e não entrou em nenhum outro.
     *
     * O crédito ao novo indicador também passava `updateEarnings = true`,
     * inflando `totalEarnings` sem que existisse pagamento algum.
     * `totalEarnings` é "total já sacado" e só updateWithdrawalStatus pode
     * mexer nele.
     */
    const [updatedReferral] = await db.transaction(async (tx) => {
      if (transferirComissao > 0) {
        await this.updateUserBalance(currentReferral.userId, -transferirComissao, false, tx);
        await this.updateUserBalance(updates.userId, transferirComissao, false, tx);
      }

      return await tx.update(referrals)
        .set(updateData)
        .where(eq(referrals.id, id))
        .returning();
    });

    // Log audit trail
    try {
      await this.logUserAction({
        userId: editorUserId,
        action: 'edit',
        entityType: 'referral',
        entityId: id,
        oldValues: {
          fullName: currentReferral.fullName,
          phone: currentReferral.phone,
          licensePlate: currentReferral.licensePlate,
          hasInsurance: currentReferral.hasInsurance,
          companyId: currentReferral.companyId,
          userId: currentReferral.userId,
          vehicleBrand: currentReferral.vehicleBrand,
          vehicleModel: currentReferral.vehicleModel,
          vehicleYear: currentReferral.vehicleYear,
          notes: currentReferral.notes,
          commissionIndicator: currentReferral.commissionIndicator,
          commissionPromoter: currentReferral.commissionPromoter,
          city: currentReferral.city,
          state: currentReferral.state
        },
        newValues: updateData,
        details: `Indicação editada: ${updatedReferral.fullName} - ${updatedReferral.licensePlate}`
      });
    } catch (error) {
      console.warn('Failed to log referral edit:', error);
    }
    
    return updatedReferral;
  }
  
  // Método removido - comissões agora são calculadas em updateReferralStatus
  
  // Company methods - OPTIMIZED (single query with JOIN)
  async getAllCompanies() {
    const companiesWithSettings = await db.select({
      id: companies.id,
      name: companies.name,
      publicToken: companies.publicToken,
      isActive: companies.isActive,
      createdAt: companies.createdAt,
      cashBalance: sql`COALESCE(${companySettings.cashBalance}, '0.00')`.as('cashBalance')
    })
    .from(companies)
    .leftJoin(companySettings, eq(companies.id, companySettings.companyId))
    .orderBy(asc(companies.name));

    return companiesWithSettings;
  }
  
  async getActiveCompanies() {
    const companiesWithSettings = await db.select({
      id: companies.id,
      name: companies.name,
      publicToken: companies.publicToken,
      isActive: companies.isActive,
      createdAt: companies.createdAt,
      cashBalance: sql`COALESCE(${companySettings.cashBalance}, '0.00')`.as('cashBalance')
    })
    .from(companies)
    .leftJoin(companySettings, eq(companies.id, companySettings.companyId))
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));

    return companiesWithSettings;
  }
  
  async createCompany(name: string, isActive: boolean = true) {
    const [company] = await db.insert(companies)
      .values({ name, isActive })
      .returning();
    
    return company;
  }

  async getCompanyById(id: number) {
    return await db.query.companies.findFirst({
      where: eq(companies.id, id)
    });
  }

  async getCompanyByToken(token: string) {
    return await db.query.companies.findFirst({
      where: eq(companies.publicToken, token)
    });
  }

  async updateCompany(id: number, data: { name?: string; isActive?: boolean }) {
    const [company] = await db.update(companies)
      .set(data)
      .where(eq(companies.id, id))
      .returning();
    
    return company;
  }

  async getCompanySettings(companyId: number) {
    const settings = await db.query.companySettings.findFirst({
      where: eq(companySettings.companyId, companyId)
    });
    
    if (!settings) {
      // Create default settings if none exist
      const [newSettings] = await db.insert(companySettings)
        .values({
          companyId,
          cashBalance: "0.00"
        })
        .returning();
      return newSettings;
    }
    
    return settings;
  }

  async updateCompanyCashBalance(companyId: number, cashBalance: string, updatedBy: number) {
    const existing = await this.getCompanySettings(companyId);
    
    const [updated] = await db.update(companySettings)
      .set({
        cashBalance,
        updatedBy,
        updatedAt: new Date()
      })
      .where(eq(companySettings.companyId, companyId))
      .returning();
    
    return updated;
  }
  
  // Withdrawal methods
  async createWithdrawalRequest(request: CreateWithdrawalRequest & {
    userId: number;
    cpfKey: string;
    requestType: "indicador" | "promotor";
    /** Definido pela rota após validar a titularidade da chave PIX. */
    status?: WithdrawalStatus;
    notes?: string;
  }) {
    /**
     * Débito e criação do saque acontecem na MESMA transação, e o débito é
     * condicional (`balance >= amount` dentro do próprio UPDATE).
     *
     * Antes, a rota lia o saldo, comparava, criava o saque e só então debitava.
     * Dois pedidos simultâneos do mesmo usuário liam o mesmo saldo, os dois
     * passavam na checagem e os dois eram debitados — saldo negativo e saque a
     * mais. Duplo clique no botão já bastava para reproduzir.
     *
     * O UPDATE condicional resolve porque o Postgres serializa a escrita na
     * linha: o segundo só enxerga o saldo já debitado e não encontra linha
     * para atualizar.
     */
    return await db.transaction(async (tx) => {
      const debited = await tx
        .update(users)
        .set({
          balance: sql`${users.balance} - ${request.amount.toFixed(2)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, request.userId),
            sql`${users.balance} >= ${request.amount.toFixed(2)}::numeric`,
          ),
        )
        .returning({ balance: users.balance });

      if (debited.length === 0) {
        throw new InsufficientBalanceError();
      }

      // A titularidade (CPF e chave PIX) é validada em POST /api/withdrawals,
      // que decide entre "pending" e "retido". Ver server/pixValidation.ts.
      const [withdrawal] = await tx.insert(withdrawalRequests)
        .values({
          userId: request.userId,
          amount: request.amount.toString(),
          pixKey: request.pixKey,
          cpfKey: request.cpfKey,
          requestType: request.requestType,
          status: request.status ?? "pending",
          notes: request.notes,
        })
        .returning();

      // Log audit trail
      await this.logUserAction({
        userId: request.userId,
        action: 'create',
        entityType: 'withdrawal_request',
        entityId: withdrawal.id,
        newValues: withdrawal,
        details: `Solicitação de saque criada: R$ ${request.amount}`
      });

      return withdrawal;
    });
  }
  
  async getWithdrawalRequestsByUserId(userId: number) {
    return await db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.userId, userId),
      orderBy: desc(withdrawalRequests.requestedAt)
    });
  }
  
  /**
   * Saques com as placas do usuário anexadas.
   *
   * Era N+1: uma consulta de placas POR saque. Com centenas de saques o painel
   * do financeiro disparava centenas de consultas em sequência. Agora são
   * DUAS consultas no total — os saques e, com um único inArray, as placas de
   * todos os usuários envolvidos — e o casamento é feito em memória.
   *
   * Aceita paginação (`limite>0`) para quando a rota quiser paginar; hoje o
   * painel do financeiro chama sem argumentos (`limite=0` = tudo). O ganho
   * garantido aqui é ter eliminado o N+1, independente de paginar ou não.
   */
  async getAllWithdrawalRequests(pagina = 1, limite = 0) {
    const semPaginacao = limite <= 0;
    const safeLimit = semPaginacao ? undefined : Math.min(limite, 500);
    const offset = safeLimit ? (Math.max(1, pagina) - 1) * safeLimit : 0;

    const withdrawals = await db.query.withdrawalRequests.findMany({
      with: { user: true, processedByUser: true },
      orderBy: desc(withdrawalRequests.requestedAt),
      ...(safeLimit ? { limit: safeLimit, offset } : {}),
    });

    if (withdrawals.length === 0) return [];

    // Placas de TODOS os usuários da página, numa consulta só.
    const userIds = Array.from(new Set(withdrawals.map((w) => w.userId)));
    const referralsDosUsuarios = await db.query.referrals.findMany({
      where: and(
        inArray(referrals.userId, userIds),
        inArray(referrals.status, ["validated", "converted", "paid"] as any),
      ),
      columns: { userId: true, licensePlate: true, createdAt: true },
      orderBy: desc(referrals.createdAt),
    });

    // Agrupa placas por usuário (já vêm ordenadas por data desc)
    const placasPorUsuario = new Map<number, string[]>();
    for (const r of referralsDosUsuarios) {
      if (!r.licensePlate) continue;
      const lista = placasPorUsuario.get(r.userId) ?? [];
      if (!lista.includes(r.licensePlate)) lista.push(r.licensePlate);
      placasPorUsuario.set(r.userId, lista);
    }

    const commissionPerReferral = 3.0;
    return withdrawals.map((withdrawal) => {
      const referralCount = Math.round(parseFloat(withdrawal.amount) / commissionPerReferral);
      const todas = placasPorUsuario.get(withdrawal.userId) ?? [];
      return {
        ...withdrawal,
        plates: todas.slice(0, Math.max(referralCount, 1)),
      };
    });
  }
  
  async getWithdrawalRequestById(id: number) {
    return await db.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, id),
      with: {
        user: true,
        processedByUser: true
      }
    });
  }
  
  async updateWithdrawalStatus(id: number, status: WithdrawalStatus, processedBy: number, notes?: string) {
    /**
     * A "idempotência" daqui era check-then-act: lia o status, comparava em
     * memória e depois fazia UPDATE sem guarda. Entre a leitura e a escrita não
     * havia transação nem lock, então duas requisições simultâneas (duplo
     * clique do financeiro, retry por timeout) passavam AMBAS pela checagem e
     * executavam os efeitos monetários duas vezes:
     *   - 'rejected' devolvia o valor ao saldo 2x (dinheiro criado do nada,
     *     imediatamente sacável);
     *   - 'paid' lançava duas saídas no fluxo de caixa e inflava totalEarnings.
     * A existência de scripts/fix-duplicate-cashflow.ts mostra que isso já
     * aconteceu em produção.
     *
     * Agora a transição é um UPDATE CONDICIONAL dentro de transação: só altera
     * a linha se ela ainda estiver no status anterior. Quem perder a corrida
     * não atualiza linha nenhuma e sai sem tocar em dinheiro.
     */
    const currentWithdrawal = await db.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, id)
    });

    if (!currentWithdrawal) {
      throw new Error(`Withdrawal request #${id} not found`);
    }

    if (currentWithdrawal.status === status) {
      console.log(`[updateWithdrawalStatus] Withdrawal #${id} already has status "${status}" - skipping duplicate processing`);
      return currentWithdrawal;
    }

    const updateData: any = {
      status,
      processedBy,
      notes
    };

    // Set processedAt for approved/rejected
    if (status === 'approved' || status === 'rejected') {
      updateData.processedAt = new Date();
    }

    // Set paidAt only when marking as paid
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }

    const [updated] = await db.update(withdrawalRequests)
      .set(updateData)
      .where(
        and(
          eq(withdrawalRequests.id, id),
          // guarda de estado: a linha precisa ainda estar no status que lemos
          eq(withdrawalRequests.status, currentWithdrawal.status),
        ),
      )
      .returning();

    // Perdeu a corrida: outra requisição já transicionou este saque.
    // Sair sem executar nenhum efeito monetário.
    if (!updated) {
      console.warn(
        `[updateWithdrawalStatus] Saque #${id} já foi transicionado por outra requisição concorrente — efeitos ignorados.`,
      );
      const atual = await db.query.withdrawalRequests.findFirst({
        where: eq(withdrawalRequests.id, id),
      });
      return atual ?? currentWithdrawal;
    }

    // Se o saque foi rejeitado, devolver o valor ao saldo do usuário
    if (status === 'rejected' && updated) {
      const amount = parseFloat(updated.amount);
      // Ao rejeitar saque, devolver o valor ao saldo mas não atualizar totalEarnings
      await this.updateUserBalance(updated.userId, amount, false);
      
      // Log audit trail
      await this.logUserAction({
        userId: processedBy,
        action: 'reject_withdrawal',
        entityType: 'withdrawal_request',
        entityId: id,
        newValues: { status: 'rejected', amount },
        details: `Saque rejeitado. Valor de R$ ${amount} devolvido ao saldo do usuário.`
      });
    }
    
    // Se o saque foi aprovado mas ainda não pago, não fazer nada com o saldo
    // O saldo já foi descontado quando a solicitação foi criada
    
    // Se o pagamento foi realizado, criar entrada no fluxo de caixa e atualizar totalEarnings
    if (status === 'paid' && updated) {
      const amount = parseFloat(updated.amount);
      
      // Atualizar totalEarnings do usuário (valor total já pago)
      await this.updateUserTotalEarnings(updated.userId, amount);
      console.log(`[updateWithdrawalStatus] Total de ganhos atualizado para usuário ${updated.userId}: +${amount}`);
      
      // Criar entrada no fluxo de caixa
      await this.createCashFlowEntry({
        type: 'outflow',
        amount,
        description: `Pagamento de saque #${id}`,
        relatedWithdrawalId: id,
        createdBy: processedBy
      });
    }
    
    return updated;
  }

  async updateWithdrawalInsurance(id: number, hasInsurance: boolean) {
    await db.update(withdrawalRequests)
      .set({ hasInsurance })
      .where(eq(withdrawalRequests.id, id));
    
    // Fetch and return the complete updated withdrawal
    const updated = await db.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, id)
    });
    
    return updated;
  }

  
  // Cash flow methods
  /**
   * O saldo corrente do caixa era calculado com read-modify-write solto:
   * lia o último lançamento e inseria o novo com o total recalculado. Duas
   * chamadas simultâneas liam o MESMO saldo anterior e gravavam totais
   * divergentes — o extrato passava a mentir a partir dali.
   *
   * Agora tudo acontece numa transação, serializada por advisory lock: só um
   * lançamento por vez calcula e grava. São operações raras (pagamento de
   * saque), então serializar não custa nada.
   */
  async createCashFlowEntry(entry: CreateCashFlow & { createdBy: number }) {
    return await db.transaction(async (tx) => {
      // Trava exclusiva do "livro caixa" enquanto a transação durar.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${CASH_FLOW_LOCK_KEY})`);

      // Ordena por id, não por createdAt: dois lançamentos no mesmo instante
      // empatam no timestamp e a leitura do "último" fica indefinida.
      const lastEntry = await tx.query.cashFlow.findFirst({
        orderBy: desc(cashFlow.id),
      });
      const currentBalance = lastEntry ? parseFloat(lastEntry.balance) : 0;

      const newBalance = entry.type === 'inflow'
        ? currentBalance + entry.amount
        : currentBalance - entry.amount;

      const [cashFlowEntry] = await tx.insert(cashFlow)
        .values({
          ...entry,
          amount: entry.amount.toString(),
          balance: newBalance.toFixed(2)
        })
        .returning();

      return cashFlowEntry;
    });
  }
  
  async getCashFlowEntries() {
    return await db.query.cashFlow.findMany({
      with: {
        createdByUser: true,
        withdrawal: {
          with: {
            user: true
          }
        }
      },
      orderBy: desc(cashFlow.createdAt)
    });
  }
  
  async getCurrentBalance() {
    // desc(id) e não desc(createdAt): timestamps iguais tornam o "último"
    // lançamento indeterminado e o saldo lido passa a variar por sorte.
    const lastEntry = await db.query.cashFlow.findFirst({
      orderBy: desc(cashFlow.id)
    });

    return lastEntry ? parseFloat(lastEntry.balance) : 0;
  }
  
  // Support ticket methods
  async createSupportTicket(userId: number, ticketData: CreateSupportTicket) {
    // O banco é quem decide a unicidade; em colisão (23505) sorteia outro número.
    const MAX_TENTATIVAS = 5;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        const [supportTicket] = await db.insert(supportTickets)
          .values({
            ...ticketData,
            userId,
            ticketNumber: this.gerarNumeroDeTicket(),
          })
          .returning();

        return supportTicket;
      } catch (erro: any) {
        const colisaoDeNumero =
          erro?.code === "23505" && String(erro?.constraint ?? "").includes("ticket_number");

        if (!colisaoDeNumero || tentativa === MAX_TENTATIVAS) throw erro;

        console.warn(
          `[TICKET] Número já usado, sorteando outro (tentativa ${tentativa}/${MAX_TENTATIVAS})`,
        );
      }
    }

    // Inalcançável: o laço ou retorna ou relança.
    throw new Error("Não foi possível gerar número de chamado");
  }
  
  async getUserSupportTickets(userId: number) {
    return await db.query.supportTickets.findMany({
      where: eq(supportTickets.userId, userId),
      with: {
        responses: {
          with: {
            user: true
          }
        }
      },
      orderBy: desc(supportTickets.createdAt)
    });
  }
  
  async getAllSupportTickets() {
    return await db.query.supportTickets.findMany({
      with: {
        user: true,
        responses: {
          with: {
            user: true
          }
        }
      },
      orderBy: desc(supportTickets.createdAt)
    });
  }
  
  async getSupportTicketById(id: number) {
    // Projeção explícita: o ticket carrega só identificação de quem abriu e de
    // quem respondeu. Sem isso a relação trazia o registro completo (hash de
    // senha, CPF, chave PIX) junto de cada resposta.
    const usuarioBasico = {
      columns: { id: true, fullName: true, username: true, role: true },
    } as const;

    return await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, id),
      with: {
        user: usuarioBasico,
        responses: {
          with: {
            user: usuarioBasico
          }
        }
      }
    });
  }
  
  async getSupportTicketsByUserId(userId: number) {
    return await db.query.supportTickets.findMany({
      where: eq(supportTickets.userId, userId),
      orderBy: [desc(supportTickets.createdAt)],
      with: {
        responses: {
          orderBy: [asc(ticketResponses.createdAt)]
        }
      }
    });
  }
  
  async updateTicketStatus(id: number, status: string) {
    const [updated] = await db.update(supportTickets)
      .set({
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, id))
      .returning();
    
    return updated;
  }
  
  async createTicketResponse(response: CreateTicketResponse & { userId: number; ticketId: number }) {
    const [ticketResponse] = await db.insert(ticketResponses)
      .values(response)
      .returning();
    
    // Atualizar data de atualização do ticket
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, response.ticketId));
    
    return ticketResponse;
  }
  
  /**
   * Número do chamado, formato YYYYMMDD-XXXX.
   *
   * Era `COUNT(*) de hoje + 1`, com dois defeitos:
   *
   *  - sob concorrência, dois chamados abertos ao mesmo tempo contavam o mesmo
   *    total e geravam o MESMO número. A coluna tem UNIQUE, então o segundo
   *    usuário recebia erro 500 ao abrir chamado;
   *  - `new Date(today.setHours(...))` MUTAVA `today`. Funcionava por sorte,
   *    porque as duas chamadas caem no mesmo dia — mas `dateStr` vinha de
   *    `toISOString()` (UTC) enquanto `setHours` é hora local, então perto da
   *    meia-noite o prefixo e a janela de contagem discordavam.
   *
   * Agora o sufixo é aleatório e a colisão (improvável) é resolvida por retry
   * no INSERT, que é onde o banco realmente decide.
   */
  private gerarNumeroDeTicket(): string {
    const agora = new Date();
    const data = [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, "0"),
      String(agora.getDate()).padStart(2, "0"),
    ].join("");

    const sufixo = randomBytes(2).toString("hex").toUpperCase(); // 4 chars
    return `${data}-${sufixo}`;
  }

  /** Mantido na interface por compatibilidade. */
  async generateTicketNumber() {
    return this.gerarNumeroDeTicket();
  }
  
  async transferReferralsToPromoter(indicadorId: number, promoterId: number | null) {
    try {
      // Update all referrals from this indicador to have the new promoterId
      await db.update(referrals)
        .set({ 
          promoterId: promoterId,
          updatedAt: new Date()
        })
        .where(eq(referrals.userId, indicadorId));
        
      console.log(`Transferred all referrals from indicador ${indicadorId} to promoter ${promoterId}`);
    } catch (error) {
      console.error('Error transferring referrals:', error);
      throw error;
    }
  }

  // Audit trail methods
  async logUserAction(action: {
    userId: number;
    action: string;
    entityType: string;
    entityId?: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    details?: string;
  }) {
    await db.insert(auditLog).values(action);
  }
  
  async getAuditLog(filters?: { userId?: number; entityType?: string; fromDate?: Date; toDate?: Date }) {
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(auditLog.userId, filters.userId));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLog.entityType, filters.entityType));
    }
    if (filters?.fromDate) {
      conditions.push(sql`${auditLog.createdAt} >= ${filters.fromDate}`);
    }
    if (filters?.toDate) {
      conditions.push(sql`${auditLog.createdAt} <= ${filters.toDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Limit results to 500 for performance - with 20k+ logs, unlimited queries are too slow
    return await db.query.auditLog.findMany({
      where: whereClause,
      with: {
        user: true
      },
      orderBy: desc(auditLog.createdAt),
      limit: 500
    });
  }

  async getRecentAuditLog(limit: number = 100) {
    return await db.query.auditLog.findMany({
      with: {
        user: true
      },
      orderBy: desc(auditLog.createdAt),
      limit
    });
  }
  
  // Referral conversation methods
  async createReferralConversation(conversationData: CreateReferralConversation & { referralId: number; userId: number }) {
    const [conversation] = await db.insert(referralConversations)
      .values(conversationData)
      .returning();
    
    // Log audit trail
    await this.logUserAction({
      userId: conversationData.userId,
      action: 'create',
      entityType: 'referral_conversation',
      entityId: conversation.id,
      newValues: conversation,
      details: `Nova mensagem na indicação #${conversationData.referralId}: ${conversationData.messageType}`
    });
    
    return conversation;
  }

  async getReferralConversations(referralId: number, userRole: string) {
    // Filter internal messages based on user role
    const whereConditions = [eq(referralConversations.referralId, referralId)];
    
    // Only admins and analysts can see internal messages
    if (userRole !== 'admin' && userRole !== 'analista') {
      whereConditions.push(eq(referralConversations.isInternal, false));
    }
    
    return await db.query.referralConversations.findMany({
      where: and(...whereConditions),
      with: {
        user: true
      },
      orderBy: asc(referralConversations.createdAt)
    });
  }

  // Team-based access methods
  async getReferralsByTeam(promoterId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.promoterId, promoterId),
      with: {
        user: true,
        createdByUser: true,
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }
  
  async getUserTeamStats(userId: number) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    
    let referralsQuery;
    if (user.role === 'promotor') {
      // Promotor vê estatísticas da sua equipe
      referralsQuery = db.query.referrals.findMany({
        where: eq(referrals.promoterId, userId)
      });
    } else {
      // Indicador vê apenas suas próprias estatísticas
      referralsQuery = db.query.referrals.findMany({
        where: eq(referrals.userId, userId)
      });
    }
    
    const teamReferrals = await referralsQuery;
    const totalReferrals = teamReferrals.length;
    const convertedReferrals = teamReferrals.filter(r => r.status === 'converted').length;
    const totalCommissions = teamReferrals.reduce((sum, r) => {
      const commission = user.role === 'promotor' 
        ? (r.commissionPromoter ? parseFloat(r.commissionPromoter) : 0)
        : (r.commissionIndicator ? parseFloat(r.commissionIndicator) : 0);
      return sum + commission;
    }, 0);
    
    return { totalReferrals, convertedReferrals, totalCommissions };
  }
  
  async validateCpfForWithdrawal(userId: number, cpfKey: string) {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    // Remove formatting from both CPFs for comparison
    const userCpf = user.cpf.replace(/\D/g, '');
    const requestCpf = cpfKey.replace(/\D/g, '');
    
    return userCpf === requestCpf;
  }

  // SALES CRM METHODS

  async createSalesLead(leadData: any, vendedorId: number) {
    const [newLead] = await db.insert(salesLeads).values({
      ...leadData,
      vendedorId
    }).returning();
    
    // Create initial activity
    await this.createSalesActivity({
      leadId: newLead.id,
      vendedorId,
      activityType: 'note',
      title: 'Lead criado',
      description: 'Novo lead adicionado ao sistema'
    });
    
    return newLead;
  }

  async getSalesLeadsByVendedor(vendedorId: number) {
    return await db.query.salesLeads.findMany({
      where: eq(salesLeads.vendedorId, vendedorId),
      with: {
        activities: {
          orderBy: desc(salesActivities.createdAt),
          limit: 3
        },
        reminders: {
          where: eq(salesReminders.isCompleted, false)
        },
        referral: true
      },
      orderBy: desc(salesLeads.createdAt)
    });
  }

  async getSalesLeadById(leadId: number, vendedorId: number) {
    return await db.query.salesLeads.findFirst({
      where: and(eq(salesLeads.id, leadId), eq(salesLeads.vendedorId, vendedorId)),
      with: {
        activities: {
          orderBy: desc(salesActivities.createdAt)
        },
        reminders: {
          orderBy: salesReminders.reminderDate
        },
        referral: true
      }
    });
  }

  async updateSalesLead(leadId: number, vendedorId: number, updates: any) {
    const oldLead = await this.getSalesLeadById(leadId, vendedorId);
    if (!oldLead) throw new Error('Lead não encontrado');

    const [updatedLead] = await db.update(salesLeads)
      .set({
        ...updates,
        updatedAt: new Date(),
        ...(updates.status === 'negocio_fechado' || updates.status === 'perdido' ? { closedAt: new Date() } : {})
      })
      .where(and(eq(salesLeads.id, leadId), eq(salesLeads.vendedorId, vendedorId)))
      .returning();

    // Log status change if status was updated
    if (updates.status && updates.status !== oldLead.status) {
      await this.createSalesActivity({
        leadId,
        vendedorId,
        activityType: 'status_change',
        title: `Status alterado para: ${this.getSalesStatusLabel(updates.status)}`,
        description: updates.notes || 'Status do lead foi alterado',
        metadata: {
          oldStatus: oldLead.status,
          newStatus: updates.status
        }
      });
    }

    return updatedLead;
  }

  async createSalesActivity(activityData: any) {
    const [activity] = await db.insert(salesActivities).values({
      ...activityData,
      completedAt: activityData.activityType !== 'follow_up' ? new Date() : null
    }).returning();
    
    return activity;
  }

  async getSalesActivitiesByLead(leadId: number, vendedorId: number) {
    return await db.query.salesActivities.findMany({
      where: and(eq(salesActivities.leadId, leadId), eq(salesActivities.vendedorId, vendedorId)),
      orderBy: desc(salesActivities.createdAt)
    });
  }

  async createSalesReminder(reminderData: any) {
    const [reminder] = await db.insert(salesReminders).values(reminderData).returning();
    return reminder;
  }

  async getSalesRemindersByVendedor(vendedorId: number) {
    return await db.query.salesReminders.findMany({
      where: and(eq(salesReminders.vendedorId, vendedorId), eq(salesReminders.isCompleted, false)),
      with: {
        lead: true
      },
      orderBy: salesReminders.reminderDate
    });
  }

  async completeSalesReminder(reminderId: number, vendedorId: number) {
    const [reminder] = await db.update(salesReminders)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(and(eq(salesReminders.id, reminderId), eq(salesReminders.vendedorId, vendedorId)))
      .returning();
    
    return reminder;
  }

  async convertReferralToLead(referralId: number, vendedorId: number) {
    const referral = await this.getReferralById(referralId);
    if (!referral) throw new Error('Indicação não encontrada');

    // Create lead from referral
    const leadData = {
      referralId: referralId,
      fullName: referral.fullName,
      phone: referral.phone,
      licensePlate: referral.licensePlate,
      hasInsurance: referral.hasInsurance,
      status: 'novo' as const,
      source: 'indicacao' as const,
      notes: `Lead criado a partir da indicação #${referralId}`
    };

    return await this.createSalesLead(leadData, vendedorId);
  }

  async getSalesStats(vendedorId: number) {
    const leads = await this.getSalesLeadsByVendedor(vendedorId);
    
    const stats = {
      total: leads.length,
      novo: leads.filter(l => l.status === 'novo').length,
      em_negociacao: leads.filter(l => l.status === 'em_negociacao').length,
      proposta_enviada: leads.filter(l => l.status === 'proposta_enviada').length,
      negocio_fechado: leads.filter(l => l.status === 'negocio_fechado').length,
      perdido: leads.filter(l => l.status === 'perdido').length,
      totalValue: leads.reduce((sum, l) => sum + (l.finalValue ? parseFloat(l.finalValue.toString()) : 0), 0),
      totalCommission: leads.reduce((sum, l) => sum + (l.actualCommission ? parseFloat(l.actualCommission.toString()) : 0), 0)
    };

    return stats;
  }

  private getSalesStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'novo': 'Novo',
      'em_negociacao': 'Em Negociação',
      'proposta_enviada': 'Proposta Enviada',
      'negocio_fechado': 'Negócio Fechado',
      'perdido': 'Perdido',
      'reagendado': 'Reagendado'
    };
    return labels[status] || status;
  }

  async getReferralByPlate(plate: string) {
    try {
      const referral = await db.query.referrals.findFirst({
        where: eq(referrals.licensePlate, plate)
      });
      
      return referral;
    } catch (error) {
      console.error(`[getReferralByPlate] Error searching plate ${plate}:`, error);
      return null;
    }
  }

  // Referral Links implementation
  async createReferralLink(userId: number, data: CreateReferralLink): Promise<ReferralLink> {
    const crypto = await import('crypto');
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        // Generate slug using name (sanitized) - this serves as both token and identifier
        const slug = data.name.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') + '-' + crypto.randomUUID().split('-')[0];
        
        // Insert linkToken (which maps to 'slug' column in the database)
        const [newLink] = await db.insert(referralLinks).values({
          userId,
          name: data.name.trim(),
          linkToken: slug,
          isActive: data.isActive ?? true,
        }).returning();

        // Log audit trail
        await this.logUserAction({
          userId,
          action: 'create_referral_link',
          entityType: 'referral_link',
          entityId: newLink.id,
          details: `Created referral link: ${slug}`
        });

        return newLink;
      } catch (error: any) {
        // Check for unique constraint violation on slug
        if (error.code === '23505' && error.detail?.includes('slug')) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('Failed to generate unique token after multiple attempts');
          }
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to create referral link');
  }

  async getReferralLinksByUserId(userId: number): Promise<ReferralLink[]> {
    try {
      const links = await db.query.referralLinks.findMany({
        where: and(
          eq(referralLinks.userId, userId),
          eq(referralLinks.isActive, true)
        ),
        orderBy: desc(referralLinks.createdAt)
      });

      return links;
    } catch (error) {
      console.error('Error fetching referral links:', error);
      throw error;
    }
  }

  async getReferralLinkById(id: number): Promise<ReferralLink | null> {
    try {
      const link = await db.query.referralLinks.findFirst({
        where: eq(referralLinks.id, id)
      });

      return link || null;
    } catch (error) {
      console.error('Error fetching referral link by id:', error);
      throw error;
    }
  }

  async updateReferralLink(id: number, userId: number, data: UpdateReferralLink): Promise<ReferralLink> {
    try {
      // First, check if the link exists and user has permission
      const existingLink = await db.query.referralLinks.findFirst({
        where: eq(referralLinks.id, id)
      });

      if (!existingLink) {
        throw new Error('Link not found');
      }

      // Check ownership or admin permission
      const user = await this.getUserById(userId);
      const hasPermission = existingLink.userId === userId || 
                           user?.role === 'admin' ||
                           (user?.role === 'analista' && user?.analystLevel === 3);

      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      /**
       * O token NÃO muda na edição.
       *
       * Antes, renomear o link regerava o slug a partir do nome — SEM o sufixo
       * aleatório que a criação usa. Dois problemas:
       *
       *  - o link já distribuído (QR code impresso, mensagem enviada) parava
       *    de funcionar, e as indicações passavam a não ser atribuídas a
       *    ninguém;
       *  - dois links com o mesmo nome geravam o mesmo slug e batiam na UNIQUE,
       *    devolvendo 500.
       *
       * Edição altera nome e situação; o token é identidade e é imutável.
       */
      const [updatedLink] = await db.update(referralLinks)
        .set({
          name: data.name.trim(),
          isActive: data.isActive
        })
        .where(eq(referralLinks.id, id))
        .returning();

      // Log audit trail
      await this.logUserAction({
        userId,
        action: 'update_referral_link',
        entityType: 'referral_link',
        entityId: id,
        details: `Updated referral link: ${data.name}`
      });

      return updatedLink;
    } catch (error) {
      console.error('Error updating referral link:', error);
      throw error;
    }
  }

  async deleteReferralLink(id: number, userId: number): Promise<void> {
    try {
      // First, check if the link exists and user has permission
      const existingLink = await db.query.referralLinks.findFirst({
        where: eq(referralLinks.id, id)
      });

      if (!existingLink) {
        throw new Error('Link not found');
      }

      // Check ownership or admin permission
      const user = await this.getUserById(userId);
      const hasPermission = existingLink.userId === userId || 
                           user?.role === 'admin' ||
                           (user?.role === 'analista' && user?.analystLevel === 3);

      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      // Soft delete - set isActive to false
      await db.update(referralLinks)
        .set({
          isActive: false
        })
        .where(eq(referralLinks.id, id));

      // Log audit trail
      await this.logUserAction({
        userId,
        action: 'delete_referral_link',
        entityType: 'referral_link',
        entityId: id,
        details: `Deleted referral link: ${existingLink.linkToken}`
      });
    } catch (error) {
      console.error('Error deleting referral link:', error);
      throw error;
    }
  }

  async trackReferralLinkClick(token: string): Promise<void> {
    try {
      const result = await db.update(referralLinks)
        .set({
          clicks: sql`COALESCE(${referralLinks.clicks}, 0) + 1`
        })
        .where(and(
          eq(referralLinks.linkToken, token),
          eq(referralLinks.isActive, true)
        ));

      // If no rows were updated, the link doesn't exist or is inactive
      if (result.rowCount === 0) {
        throw new Error('Referral link not found or inactive');
      }
    } catch (error) {
      console.error('Error tracking referral link click:', error);
      throw error;
    }
  }

  async createUserWithReferralAttribution(userData: CreateUserInput, referralToken?: string): Promise<any> {
    try {
      return await db.transaction(async (tx) => {
        let assignmentData: {
          promoterId?: number;
          supervisorId?: number;
        } = {};

        if (referralToken) {
          // Find the referral link and its owner
          const link = await tx.query.referralLinks.findFirst({
            where: and(
              eq(referralLinks.linkToken, referralToken),
              eq(referralLinks.isActive, true)
            ),
            with: {
              user: true
            }
          });

          if (link && link.user) {
            const owner = link.user;
            
            // Special case: certain promoters' referral links create indicador_nivel_1
            const specialPromoterEmails = ['marcelomacedo@gmail.com', 'wescleygondim@yahoo.com.br'];
            const isSpecialPromoter = specialPromoterEmails.includes(owner.username?.toLowerCase() || '');
            if (isSpecialPromoter) {
              userData.role = 'indicador_nivel_1';
            }
            
            // Determine assignment based on owner role
            if (owner.role === 'analista' && owner.analystLevel === 3) {
              assignmentData = { supervisorId: owner.id };
            } else if (owner.role === 'promotor') {
              assignmentData = { 
                promoterId: owner.id,
                supervisorId: owner.supervisorId || undefined
              };
            }

            // Increment registrations count
            await tx.update(referralLinks)
              .set({
                registrations: sql`COALESCE(${referralLinks.registrations}, 0) + 1`
              })
              .where(eq(referralLinks.id, link.id));
          }
        }

        // Create user with assignment data
        const userDataWithAssignment = {
          ...userData,
          ...assignmentData,
          // Ensure required fields have default values if not provided
          city: userData.city || 'Não informado',
          state: userData.state || 'N/A',
          zipCode: userData.zipCode || '00000-000',
          shirtSize: userData.shirtSize || 'M',
          // Ensure null values are converted to undefined for compatibility
          createdBy: userData.createdBy ?? undefined,
          promoterId: assignmentData.promoterId ?? userData.promoterId ?? undefined,
          analystId: userData.analystId ?? undefined,
          supervisorId: assignmentData.supervisorId ?? userData.supervisorId ?? undefined
        };

        // `tx` explícito: sem ele o INSERT sairia da transação e tomaria uma
        // segunda conexão do pool com a primeira ainda presa.
        const newUser = await this.createUser(userDataWithAssignment, tx);

        // Log audit trail if referral attribution was made
        if (referralToken && Object.keys(assignmentData).length > 0) {
          await this.logUserAction({
            userId: newUser.id,
            action: 'register_with_referral',
            entityType: 'user',
            entityId: newUser.id,
            details: `User registered via referral link: ${referralToken}`
          });
        }

        return newUser;
      });
    } catch (error) {
      console.error('Error creating user with referral attribution:', error);
      throw error;
    }
  }

}

export const storage = new DatabaseStorage();