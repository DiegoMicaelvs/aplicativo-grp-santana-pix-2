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
  referralConversations,
  salesLeads,
  salesActivities,
  salesReminders,
  type InsertUser, 
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
  type CreateSalesReminder
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
  createReferral(referral: CreateReferral & { userId: number }): Promise<any>;
  getReferralById(id: number): Promise<any>;
  getReferralsByUserId(userId: number): Promise<any[]>;
  getReferralsByUsers(userIds: number[]): Promise<any[]>;
  getAllReferrals(): Promise<any[]>;
  getReferralsByStatus(status: ReferralStatus): Promise<any[]>;
  checkDuplicateReferral(phone?: string, licensePlate?: string): Promise<any[]>;
  updateReferralStatus(id: number, status: ReferralStatus, notes?: string, adminUserId?: number): Promise<any>;
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
  
  // Promoter management methods
  transferReferralsToPromoter(indicadorId: number, promoterId: number | null): Promise<void>;
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
    try {
      const [user] = await db.insert(users)
        .values({
          ...userData,
          role: (userData.role || "indicador") as any,
          analystLevel: userData.analystLevel as any
        })
        .returning();
      
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
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

  async deleteUser(userId: number) {
    // Begin transaction to delete user and related data safely
    await db.transaction(async (tx) => {
      // First, delete related data in the correct order (respecting foreign key constraints)
      
      // Delete support ticket responses
      await tx.delete(ticketResponses)
        .where(eq(ticketResponses.userId, userId));
      
      // Delete support tickets
      await tx.delete(supportTickets)
        .where(eq(supportTickets.userId, userId));
      
      // Delete referral conversations
      await tx.delete(referralConversations)
        .where(eq(referralConversations.userId, userId));
      
      // Delete audit logs
      await tx.delete(auditLog)
        .where(eq(auditLog.userId, userId));
      
      // Delete cash flow entries (created by user)
      await tx.delete(cashFlow)
        .where(eq(cashFlow.createdBy, userId));
      
      // Delete withdrawal requests
      await tx.delete(withdrawalRequests)
        .where(eq(withdrawalRequests.userId, userId));
      
      // Delete referrals (both created by user and assigned to user)
      await tx.delete(referrals)
        .where(or(
          eq(referrals.userId, userId),
          eq(referrals.createdBy, userId)
        ));
      
      // Update any users that have this user as promoter (set to null)
      await tx.update(users)
        .set({ promoterId: null })
        .where(eq(users.promoterId, userId));
      
      // Update any users that were created by this user (set to null)
      await tx.update(users)
        .set({ createdBy: null })
        .where(eq(users.createdBy, userId));
      
      // Finally, delete the user
      await tx.delete(users)
        .where(eq(users.id, userId));
    });
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
  
  async getReferralsByUserId(userId: number) {
    return await db.query.referrals.findMany({
      where: eq(referrals.userId, userId),
      with: {
        company: true
      },
      orderBy: desc(referrals.createdAt)
    });
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
  
  async updateReferralStatus(id: number, status: ReferralStatus, notes?: string, adminUserId?: number) {
    const referral = await this.getReferralById(id);
    if (!referral) {
      throw new Error("Referral not found");
    }
    
    const previousStatus = referral.status;
    const previousCommissionIndicator = parseFloat(referral.commissionIndicator?.toString() || '0');
    const previousCommissionPromoter = parseFloat(referral.commissionPromoter?.toString() || '0');
    
    // Check if we're moving from a paid status to a non-paid status
    const wasPaidStatus = previousStatus === 'validated' || previousStatus === 'converted';
    const isNewPaidStatus = status === 'validated' || status === 'converted';
    const shouldRevertCommissions = wasPaidStatus && !isNewPaidStatus;
    const shouldCalculateCommissions = !wasPaidStatus && isNewPaidStatus;
    
    // Add to status history
    const currentHistory = referral.statusHistory || [];
    const newHistoryEntry = {
      status,
      changedBy: adminUserId || 0,
      changedAt: new Date().toISOString(),
      notes: notes || ''
    };
    
    let newCommissionIndicator = previousCommissionIndicator;
    let newCommissionPromoter = previousCommissionPromoter;
    
    // Revert commissions if moving from paid to non-paid status
    if (shouldRevertCommissions) {
      console.log(`Reverting commissions for referral ${id}: Indicator: -${previousCommissionIndicator}, Promoter: -${previousCommissionPromoter}`);
      
      // Remove commissions from user balances
      const user = await this.getUserById(referral.userId);
      if (user && previousCommissionIndicator > 0) {
        await this.updateUserBalance(user.id, -previousCommissionIndicator);
      }
      
      // Remove promoter commission if exists
      if (user?.promoterId && previousCommissionPromoter > 0) {
        await this.updateUserBalance(user.promoterId, -previousCommissionPromoter);
      }
      
      newCommissionIndicator = 0;
      newCommissionPromoter = 0;
    }
    
    const [updatedReferral] = await db.update(referrals)
      .set({ 
        status, 
        notes,
        commissionIndicator: newCommissionIndicator.toString(),
        commissionPromoter: newCommissionPromoter.toString(),
        statusHistory: [...currentHistory, newHistoryEntry],
        updatedAt: new Date()
      })
      .where(eq(referrals.id, id))
      .returning();
    
    // Calculate new commissions if moving to paid status
    if (shouldCalculateCommissions) {
      await this.calculateCommissions(id);
    }
    
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
            commissionIndicator: newCommissionIndicator,
            commissionPromoter: newCommissionPromoter 
          },
          details: `Status alterado de ${previousStatus} para ${status}${shouldRevertCommissions ? ' (comissões revertidas)' : ''}${notes ? `: ${notes}` : ''}`
        });
      } catch (error) {
        console.warn('Failed to log status update:', error);
        // Don't fail the status update if audit logging fails
      }
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
      orderBy: asc(companies.name)
    });
  }
  
  async getActiveCompanies() {
    return await db.query.companies.findMany({
      where: eq(companies.isActive, true),
      orderBy: asc(companies.name)
    });
  }
  
  async createCompany(name: string, isActive: boolean = true) {
    const [company] = await db.insert(companies)
      .values({ name, isActive })
      .returning();
    
    return company;
  }

  async updateCompany(id: number, data: { name?: string; isActive?: boolean }) {
    const [company] = await db.update(companies)
      .set(data)
      .where(eq(companies.id, id))
      .returning();
    
    return company;
  }
  
  // Withdrawal methods
  async createWithdrawalRequest(request: CreateWithdrawalRequest & { userId: number; cpfKey: string; requestType: "indicador" | "promotor" }) {
    // Validate CPF matches user's registered CPF
    const isValidCpf = await this.validateCpfForWithdrawal(request.userId, request.cpfKey);
    if (!isValidCpf) {
      throw new Error('A chave PIX (CPF) deve corresponder ao CPF cadastrado no perfil');
    }
    
    const [withdrawal] = await db.insert(withdrawalRequests)
      .values({
        userId: request.userId,
        amount: request.amount.toString(),
        pixKey: request.pixKey,
        cpfKey: request.cpfKey,
        requestType: request.requestType
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
        amount: entry.amount.toString(),
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
  async createSupportTicket(userId: number, ticketData: CreateSupportTicket) {
    const ticketNumber = await this.generateTicketNumber();
    
    const [supportTicket] = await db.insert(supportTickets)
      .values({
        ...ticketData,
        userId,
        ticketNumber
      })
      .returning();
    
    return supportTicket;
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
    
    return await db.query.auditLog.findMany({
      where: whereClause,
      with: {
        user: true
      },
      orderBy: desc(auditLog.createdAt)
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

}

export const storage = new DatabaseStorage();