import { db } from "@db";
import { eq, desc, asc, or, count, and, sql } from "drizzle-orm";
import { 
  users, 
  referrals, 
  companies,
  withdrawalRequests,
  cashFlow,
  supportTickets,
  ticketResponses,
  auditLog,
  type InsertUser, 
  type CreateReferral, 
  type ReferralStatus,
  type WithdrawalStatus,
  type Company,
  type CreateWithdrawalRequest,
  type CreateSupportTicket,
  type CreateTicketResponse,
  type CreateCashFlow
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

// Create session store
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  createUser(user: InsertUser & { createdBy?: number }): Promise<any>;
  getUserById(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getUserByCpf(cpf: string): Promise<any>;
  getAllUsers(): Promise<any[]>;
  getUsersByRole(role: string): Promise<any[]>;
  getUsersByCreator(creatorId: number): Promise<any[]>;
  getIndicadoresByPromoter(promoterId: number): Promise<any[]>;
  updateUserBalance(userId: number, amount: number): Promise<void>;
  updateUserPermissions(userId: number, permissions: string[], analystLevel?: number): Promise<any>;
  updateUserProfile(userId: number, updates: any): Promise<any>;
  updateUserStatus(userId: number, isActive: boolean): Promise<any>;
  resetUserPassword(userId: number): Promise<string>;
  
  // Referral methods
  createReferral(referral: CreateReferral & { userId: number }): Promise<any>;
  getReferralById(id: number): Promise<any>;
  getReferralsByUserId(userId: number): Promise<any[]>;
  getAllReferrals(): Promise<any[]>;
  getReferralsByStatus(status: ReferralStatus): Promise<any[]>;
  checkDuplicateReferral(phone?: string, licensePlate?: string): Promise<any[]>;
  updateReferralStatus(id: number, status: ReferralStatus, notes?: string): Promise<any>;
  calculateCommissions(referralId: number): Promise<void>;
  
  // Company methods
  getAllCompanies(): Promise<Company[]>;
  createCompany(name: string): Promise<Company>;
  
  // Withdrawal methods
  createWithdrawalRequest(request: CreateWithdrawalRequest & { userId: number }): Promise<any>;
  getWithdrawalRequestsByUserId(userId: number): Promise<any[]>;
  getAllWithdrawalRequests(): Promise<any[]>;
  updateWithdrawalStatus(id: number, status: WithdrawalStatus, processedBy: number, notes?: string): Promise<any>;
  
  // Cash flow methods
  createCashFlowEntry(entry: CreateCashFlow & { createdBy: number }): Promise<any>;
  getCashFlowEntries(): Promise<any[]>;
  getCurrentBalance(): Promise<number>;
  
  // Support ticket methods
  createSupportTicket(ticket: CreateSupportTicket & { userId: number }): Promise<any>;
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
  getAuditLog(filters?: { userId?: number; entityType?: string; fromDate?: Date; toDate?: Date }): Promise<any[]>;
  
  // Team-based access methods
  getReferralsByTeam(promoterId: number): Promise<any[]>;
  getUserTeamStats(userId: number): Promise<{ totalReferrals: number; convertedReferrals: number; totalCommissions: number }>;
  validateCpfForWithdrawal(userId: number, cpfKey: string): Promise<boolean>;
  generateTicketNumber(): Promise<string>;
  
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
  async createUser(userData: InsertUser & { createdBy?: number; promoterId?: number }) {
    const [user] = await db.insert(users)
      .values({
        ...userData,
      })
      .returning();
    
    return user;
  }
  
  async getUserById(id: number) {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }
  
  async getUserByUsername(username: string) {
    return await db.query.users.findFirst({
      where: eq(users.username, username)
    });
  }
  
  async getUserByCpf(cpf: string) {
    return await db.query.users.findFirst({
      where: eq(users.cpf, cpf)
    });
  }
  
  async getAllUsers() {
    return await db.query.users.findMany({
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
  
  async updateUserBalance(userId: number, amount: number) {
    await db.update(users)
      .set({ 
        balance: sql`balance + ${amount}`,
        totalEarnings: sql`total_earnings + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
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

  async resetUserPassword(userId: number) {
    // Generate a new temporary password
    const newPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // In production, this should be hashed
    const [updatedUser] = await db.update(users)
      .set({ 
        password: newPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return newPassword;
  }
  
  // Referral methods
  async createReferral(referralData: CreateReferral & { userId: number; createdBy: number; promoterId?: number }) {
    // Get user info to determine promoter
    const user = await this.getUserById(referralData.userId);
    const promoterId = referralData.promoterId || user?.promoterId || null;
    
    const [referral] = await db.insert(referrals)
      .values({
        ...referralData,
        promoterId,
        statusHistory: [{
          status: 'pending',
          changedBy: referralData.createdBy,
          changedAt: new Date().toISOString(),
          notes: 'Indicação criada'
        }]
      })
      .returning();
    
    // Log audit trail
    await this.logUserAction({
      userId: referralData.createdBy,
      action: 'create',
      entityType: 'referral',
      entityId: referral.id,
      newValues: referral,
      details: `Nova indicação criada: ${referralData.fullName}`
    });
    
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
  
  async getReferralsByUserId(userId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.userId, userId),
      with: {
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
  }
  
  async getAllReferrals() {
    return await db.query.referrals.findMany({
      with: {
        user: true,
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
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
    if (phone) conditions.push(eq(referrals.phone, phone));
    if (licensePlate) conditions.push(eq(referrals.licensePlate, licensePlate));
    
    if (conditions.length === 0) return [];
    
    return await db.query.referrals.findMany({
      where: or(...conditions),
      with: {
        user: true
      }
    });
  }
  
  async updateReferralStatus(id: number, status: ReferralStatus, notes?: string) {
    const [updatedReferral] = await db.update(referrals)
      .set({ 
        status, 
        notes,
        updatedAt: new Date()
      })
      .where(eq(referrals.id, id))
      .returning();
    
    // Calculate commissions if status is validated or converted
    if (status === 'validated' || status === 'converted') {
      await this.calculateCommissions(id);
    }
    
    return updatedReferral;
  }
  
  async calculateCommissions(referralId: number) {
    const referral = await this.getReferralById(referralId);
    if (!referral) return;
    
    const user = await this.getUserById(referral.userId);
    if (!user) return;
    
    let indicatorCommission = 0;
    let promoterCommission = 0;
    
    if (referral.status === 'validated') {
      indicatorCommission = 3; // R$3 por cadastro validado
      
      // Se o indicador tem um promotor, ele ganha R$1
      if (user.promoterId) {
        const promoter = await this.getUserById(user.promoterId);
        if (promoter && promoter.role === 'promotor') {
          promoterCommission = 1;
          await this.updateUserBalance(promoter.id, promoterCommission);
        }
      }
    } else if (referral.status === 'converted') {
      indicatorCommission = 50; // R$50 por conversão
      
      // Se o indicador tem um promotor, ele ganha R$10
      if (user.promoterId) {
        const promoter = await this.getUserById(user.promoterId);
        if (promoter && promoter.role === 'promotor') {
          promoterCommission = 10;
          await this.updateUserBalance(promoter.id, promoterCommission);
        }
      }
    }
    
    // Atualizar saldo do indicador
    if (indicatorCommission > 0) {
      await this.updateUserBalance(user.id, indicatorCommission);
    }
    
    // Atualizar comissões na indicação
    await db.update(referrals)
      .set({
        commissionIndicator: indicatorCommission.toString(),
        commissionPromoter: promoterCommission.toString()
      })
      .where(eq(referrals.id, referralId));
  }
  
  // Company methods
  async getAllCompanies() {
    return await db.query.companies.findMany({
      where: eq(companies.isActive, true),
      orderBy: asc(companies.name)
    });
  }
  
  async createCompany(name: string) {
    const [company] = await db.insert(companies)
      .values({ name })
      .returning();
    
    return company;
  }
  
  // Withdrawal methods
  async createWithdrawalRequest(request: CreateWithdrawalRequest & { userId: number }) {
    // Validate CPF matches user's registered CPF
    const isValidCpf = await this.validateCpfForWithdrawal(request.userId, request.pixKey);
    if (!isValidCpf) {
      throw new Error('A chave PIX (CPF) deve corresponder ao CPF cadastrado no perfil');
    }
    
    const [withdrawal] = await db.insert(withdrawalRequests)
      .values(request)
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
  }
  
  async getWithdrawalRequestsByUserId(userId: number) {
    return await db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.userId, userId),
      orderBy: desc(withdrawalRequests.requestedAt)
    });
  }
  
  async getAllWithdrawalRequests() {
    return await db.query.withdrawalRequests.findMany({
      with: {
        user: true,
        processedByUser: true
      },
      orderBy: desc(withdrawalRequests.requestedAt)
    });
  }
  
  async updateWithdrawalStatus(id: number, status: WithdrawalStatus, processedBy: number, notes?: string) {
    const [updated] = await db.update(withdrawalRequests)
      .set({
        status,
        processedBy,
        processedAt: new Date(),
        notes
      })
      .where(eq(withdrawalRequests.id, id))
      .returning();
    
    // Se o pagamento foi realizado, atualizar o saldo do usuário
    if (status === 'paid' && updated) {
      const amount = parseFloat(updated.amount);
      await this.updateUserBalance(updated.userId, -amount);
      
      // Criar entrada no fluxo de caixa
      const currentBalance = await this.getCurrentBalance();
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
  
  // Cash flow methods
  async createCashFlowEntry(entry: CreateCashFlow & { createdBy: number }) {
    const currentBalance = await this.getCurrentBalance();
    const newBalance = entry.type === 'inflow' 
      ? currentBalance + entry.amount 
      : currentBalance - entry.amount;
    
    const [cashFlowEntry] = await db.insert(cashFlow)
      .values({
        ...entry,
        balance: newBalance.toString()
      })
      .returning();
    
    return cashFlowEntry;
  }
  
  async getCashFlowEntries() {
    return await db.query.cashFlow.findMany({
      with: {
        createdByUser: true,
        withdrawal: true
      },
      orderBy: desc(cashFlow.createdAt)
    });
  }
  
  async getCurrentBalance() {
    const lastEntry = await db.query.cashFlow.findFirst({
      orderBy: desc(cashFlow.createdAt)
    });
    
    return lastEntry ? parseFloat(lastEntry.balance) : 0;
  }
  
  // Support ticket methods
  async createSupportTicket(ticket: CreateSupportTicket & { userId: number }) {
    const ticketNumber = await this.generateTicketNumber();
    
    const [supportTicket] = await db.insert(supportTickets)
      .values({
        ...ticket,
        ticketNumber
      })
      .returning();
    
    return supportTicket;
  }
  
  async getSupportTicketsByUserId(userId: number) {
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
    return await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, id),
      with: {
        user: true,
        responses: {
          with: {
            user: true
          }
        }
      }
    });
  }
  
  async updateTicketStatus(id: number, status: string) {
    const [updated] = await db.update(supportTickets)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, id))
      .returning();
    
    return updated;
  }
  
  async createTicketResponse(response: CreateTicketResponse) {
    const [ticketResponse] = await db.insert(ticketResponses)
      .values(response)
      .returning();
    
    // Atualizar data de atualização do ticket
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, response.ticketId));
    
    return ticketResponse;
  }
  
  async generateTicketNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Contar tickets criados hoje
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));
    
    const todayTickets = await db.query.supportTickets.findMany({
      where: and(
        sql`${supportTickets.createdAt} >= ${todayStart}`,
        sql`${supportTickets.createdAt} <= ${todayEnd}`
      )
    });
    
    const sequenceNumber = (todayTickets.length + 1).toString().padStart(4, '0');
    return `${dateStr}-${sequenceNumber}`;
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
    
    return await db.query.auditLog.findMany({
      where: whereClause,
      with: {
        user: true
      },
      orderBy: desc(auditLog.createdAt)
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
}

export const storage = new DatabaseStorage();