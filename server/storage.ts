import { db } from "@db";
import { eq, desc, asc, or, count, and, sql } from "drizzle-orm";
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
  createReferral(referral: CreateReferral & { userId: number; plates?: string[] }): Promise<any>;
  getReferralById(id: number): Promise<any>;
  getAllReferralsForMetisViewer(): Promise<any[]>;
  getReferralsByUserId(userId: number): Promise<any[]>;
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
  
  // Referral Link methods
  createReferralLink(userId: number, data: CreateReferralLink): Promise<ReferralLink>;
  getReferralLinksByUserId(userId: number): Promise<ReferralLink[]>;
  getReferralLinkById(id: number): Promise<ReferralLink | null>;
  updateReferralLink(id: number, userId: number, data: UpdateReferralLink): Promise<ReferralLink>;
  deleteReferralLink(id: number, userId: number): Promise<void>;
  trackReferralLinkClick(token: string): Promise<void>;
  createUserWithReferralAttribution(userData: InsertUser, referralToken?: string): Promise<any>;
  
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
  async createUser(userData: InsertUser & { createdBy?: number; promoterId?: number; analystId?: number; supervisorId?: number }) {
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
        balance: "0",
        totalEarnings: "0",
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [user] = await db.insert(users)
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
  
  async updateUserBalance(userId: number, amount: number, updateEarnings: boolean = false) {
    try {
      console.log(`[updateUserBalance] Atualizando saldo do usuário ${userId} com valor: ${amount}, updateEarnings: ${updateEarnings}`);
      
      // Buscar saldo atual para debug
      const currentUser = await this.getUserById(userId);
      if (currentUser) {
        console.log(`[updateUserBalance] Saldo atual: ${currentUser.balance}, Total ganhos: ${currentUser.totalEarnings}`);
      }
      
      // REGRA DE NEGÓCIO CORRIGIDA:
      // - balance: saldo disponível para saque (comissões pendentes)
      // - totalEarnings: valor total já pago ao usuário (apenas saques pagos)
      // Por padrão, apenas atualiza o saldo disponível
      // O totalEarnings só é atualizado quando updateEarnings=true (quando saque é pago)
      if (updateEarnings) {
        await db.update(users)
          .set({ 
            balance: sql`balance + ${amount}`,
            totalEarnings: sql`total_earnings + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      } else {
        await db.update(users)
          .set({ 
            balance: sql`balance + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
      
      // Verificar saldo após atualização
      const updatedUser = await this.getUserById(userId);
      if (updatedUser) {
        console.log(`[updateUserBalance] Novo saldo: ${updatedUser.balance}, Novo total ganhos: ${updatedUser.totalEarnings}`);
      }
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
  async createReferral(referralData: CreateReferral & { userId: number; createdBy: number; promoterId?: number; plates?: string[] }) {
    // Get user info to determine promoter
    const user = await this.getUserById(referralData.userId);
    const promoterId = referralData.promoterId || user?.promoterId || null;
    
    // Get plates from either the new licensePlates array or the legacy plates parameter  
    const platesToCreate = referralData.plates || referralData.licensePlates || [];
    const primaryPlate = platesToCreate[0];
    
    // Destructure referralData to exclude licensePlates field (not in database table)
    const { licensePlates, plates, ...referralDataForDB } = referralData;
    
    const [referral] = await db.insert(referrals)
      .values({
        ...referralDataForDB,
        licensePlate: primaryPlate, // Keep backward compatibility
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
  
  async updateReferralStatus(id: number, status: ReferralStatus, notes?: string, adminUserId?: number) {
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
      
      // Add to status history
      const currentHistory = referral.statusHistory || [];
      const newHistoryEntry = {
        status,
        changedBy: adminUserId || 0,
        changedAt: new Date().toISOString(),
        notes: notes || ''
      };
      
      // Calculate new commission values based on status
      let newCommissionIndicator = 0;
      let newCommissionPromoter = 0;
      
      if (status === 'validated') {
        newCommissionIndicator = 3; // R$ 3 por validado
        newCommissionPromoter = 1; // R$ 1 para o promotor
      } else if (status === 'converted') {
        // Se estava validado antes, soma as comissões
        if (previousStatus === 'validated') {
          newCommissionIndicator = previousCommissionIndicator + 50; // Soma R$ 50 aos R$ 3 existentes
          newCommissionPromoter = previousCommissionPromoter + 10; // Soma R$ 10 ao R$ 1 existente
        } else {
          newCommissionIndicator = 50; // R$ 50 por conversão
          newCommissionPromoter = 10; // R$ 10 para o promotor
        }
      } else if (status === 'paid') {
        // Mantém as comissões existentes quando muda para pago
        newCommissionIndicator = previousCommissionIndicator;
        newCommissionPromoter = previousCommissionPromoter;
      }
      // Para outros status (pending, rejected, analyzing), as comissões são zero
      
      console.log(`[updateReferralStatus] New commissions: indicator=${newCommissionIndicator}, promoter=${newCommissionPromoter}`);
      
      // Calculate the difference in commissions
      const commissionDifferenceIndicator = newCommissionIndicator - previousCommissionIndicator;
      const commissionDifferencePromoter = newCommissionPromoter - previousCommissionPromoter;
      
      console.log(`[updateReferralStatus] Commission differences: indicator=${commissionDifferenceIndicator}, promoter=${commissionDifferencePromoter}`);
      
      // Update user balances based on commission differences
      const user = await this.getUserById(referral.userId);
      if (user && commissionDifferenceIndicator !== 0) {
        await this.updateUserBalance(user.id, commissionDifferenceIndicator);
        console.log(`[updateReferralStatus] Updated indicator balance for user ${user.id}: ${commissionDifferenceIndicator > 0 ? '+' : ''}${commissionDifferenceIndicator}`);
      }
      
      // Update promoter balance if exists
      if (user?.promoterId && commissionDifferencePromoter !== 0) {
        await this.updateUserBalance(user.promoterId, commissionDifferencePromoter);
        console.log(`[updateReferralStatus] Updated promoter balance for user ${user.promoterId}: ${commissionDifferencePromoter > 0 ? '+' : ''}${commissionDifferencePromoter}`);
      }
      
      // REMOVIDO: Não atualizar totalEarnings quando indicação é paga
      // O totalEarnings deve ser atualizado apenas quando um SAQUE é pago, não quando uma indicação é paga
      
      const [updatedReferral] = await db.update(referrals)
        .set({ 
          status, 
          notes,
          commissionIndicator: newCommissionIndicator.toFixed(2),
          commissionPromoter: newCommissionPromoter.toFixed(2),
          statusHistory: [...currentHistory, newHistoryEntry],
          updatedAt: new Date()
        })
        .where(eq(referrals.id, id))
        .returning();
      
      console.log(`[updateReferralStatus] Referral updated successfully`);
      
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
            details: `Status alterado de ${previousStatus} para ${status}${commissionDifferenceIndicator < 0 ? ' (comissões revertidas)' : ''}${notes ? `: ${notes}` : ''}`
          });
        } catch (error) {
          console.warn('Failed to log status update:', error);
          // Don't fail the status update if audit logging fails
        }
      }
      
      return updatedReferral;
    } catch (error) {
      console.error(`[updateReferralStatus] Error updating referral ${id}:`, error);
      throw error;
    }
  }

  async validateReferral(id: number, validationData: any, validatorUserId: number) {
    const referral = await this.getReferralById(id);
    if (!referral) {
      throw new Error("Referral not found");
    }

    // Calculate commission values for validated status
    const newCommissionIndicator = 3; // R$ 3 por validado
    const newCommissionPromoter = 1; // R$ 1 para o promotor
    
    // Calculate commission differences for user balance updates
    const previousCommissionIndicator = parseFloat(referral.commissionIndicator?.toString() || '0');
    const previousCommissionPromoter = parseFloat(referral.commissionPromoter?.toString() || '0');
    const commissionDifferenceIndicator = newCommissionIndicator - previousCommissionIndicator;
    const commissionDifferencePromoter = newCommissionPromoter - previousCommissionPromoter;
    
    // Update user balances
    if (commissionDifferenceIndicator !== 0) {
      await this.updateUserBalance(referral.userId, commissionDifferenceIndicator);
    }
    
    // Update promoter balance if exists
    const user = await this.getUserById(referral.userId);
    if (user?.promoterId && commissionDifferencePromoter !== 0) {
      await this.updateUserBalance(user.promoterId, commissionDifferencePromoter);
    }

    // Add validation entry to status history
    const currentHistory = referral.statusHistory || [];
    const validationHistoryEntry = {
      status: 'validated',
      changedBy: validatorUserId,
      changedAt: new Date().toISOString(),
      notes: validationData.validationNotes || `Validação: ${validationData.vehicleBrand} ${validationData.vehicleModel} ${validationData.vehicleYear}`
    };

    // Update referral with validation data and add to status history
    const [updatedReferral] = await db.update(referrals)
      .set({
        vehicleBrand: validationData.vehicleBrand,
        vehicleModel: validationData.vehicleModel,
        vehicleYear: validationData.vehicleYear,
        nameCorrect: validationData.nameCorrect,
        plateCorrect: validationData.plateCorrect,
        phoneCorrect: validationData.phoneCorrect,
        validationNotes: validationData.validationNotes,
        validatedBy: validatorUserId,
        validatedAt: new Date(),
        status: 'validated', // Set status to validated
        commissionIndicator: newCommissionIndicator.toFixed(2),
        commissionPromoter: newCommissionPromoter.toFixed(2),
        statusHistory: [...currentHistory, validationHistoryEntry],
        updatedAt: new Date()
      })
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
        details: `Indicação validada: ${validationData.vehicleBrand} ${validationData.vehicleModel} ${validationData.vehicleYear}${validationData.validationNotes ? ` - ${validationData.validationNotes}` : ''}`
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
      const currentCommissionIndicator = parseFloat(currentReferral.commissionIndicator?.toString() || '0');
      const currentCommissionPromoter = parseFloat(currentReferral.commissionPromoter?.toString() || '0');
      
      if (currentCommissionIndicator > 0) {
        console.log(`[updateReferral] Transferindo comissão de ${currentCommissionIndicator} do usuário ${currentReferral.userId} para ${updates.userId}`);
        
        // Remove commission from old user
        await this.updateUserBalance(currentReferral.userId, -currentCommissionIndicator, false);
        
        // Add commission to new user  
        await this.updateUserBalance(updates.userId, currentCommissionIndicator, true);
        
        // Also handle promoter commission if exists
        if (currentReferral.promoterId && currentCommissionPromoter > 0) {
          // The promoter commission stays with the original promoter, no change needed
          console.log(`[updateReferral] Comissão do promotor mantida com o promotor original ${currentReferral.promoterId}`);
        }
      }
    }
    
    // Handle status update separately to ensure commission calculations
    if (updates.status !== undefined && updates.status !== currentReferral.status) {
      // Use updateReferralStatus for status changes to handle commissions
      return await this.updateReferralStatus(id, updates.status, updates.notes, editorUserId);
    }

    // Update referral
    const [updatedReferral] = await db.update(referrals)
      .set(updateData)
      .where(eq(referrals.id, id))
      .returning();

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
          commissionPromoter: currentReferral.commissionPromoter
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
  async createWithdrawalRequest(request: CreateWithdrawalRequest & { userId: number; cpfKey: string; requestType: "indicador" | "promotor" }) {
    // Permitir que o usuário informe o CPF do titular da conta
    // Removida validação restritiva que exigia CPF idêntico ao do perfil
    
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
    // Get withdrawal requests with user info
    const withdrawals = await db.query.withdrawalRequests.findMany({
      with: {
        user: true,
        processedByUser: true
      },
      orderBy: desc(withdrawalRequests.requestedAt)
    });

    return withdrawals;
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
      .where(eq(withdrawalRequests.id, id))
      .returning();
    
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

      // Generate new slug from name
      const slug = data.name.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const [updatedLink] = await db.update(referralLinks)
        .set({
          linkToken: slug, // Update slug/token (name will have same value automatically)
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

  async createUserWithReferralAttribution(userData: InsertUser, referralToken?: string): Promise<any> {
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
          // Ensure null values are converted to undefined for compatibility
          createdBy: userData.createdBy ?? undefined,
          promoterId: assignmentData.promoterId ?? userData.promoterId ?? undefined,
          analystId: userData.analystId ?? undefined,
          supervisorId: assignmentData.supervisorId ?? userData.supervisorId ?? undefined
        };

        const newUser = await this.createUser(userDataWithAssignment);

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