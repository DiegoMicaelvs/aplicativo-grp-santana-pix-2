import { db } from "@db";
import { eq, desc, asc, or, count, and } from "drizzle-orm";
import { users, referrals, bannedUsers } from "@shared/schema";
import { InsertUser, CreateReferral, ReferralStatus, BanUser, BannedUser } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

// Create session store
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  createUser(user: InsertUser): Promise<any>;
  getUserById(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getAllUsers(): Promise<any[]>;
  
  // Referral methods
  createReferral(referral: CreateReferral & { userId: number }): Promise<any>;
  getReferralById(id: number): Promise<any>;
  getReferralsByUserId(userId: number): Promise<any[]>;
  getAllReferrals(): Promise<any[]>;
  checkDuplicateReferral(phone?: string, licensePlate?: string): Promise<any[]>;
  updateReferralStatus(
    id: number, 
    status: ReferralStatus, 
    commission?: number,
    notes?: string,
    paidAt?: Date
  ): Promise<any>;
  
  // Compliance methods
  checkBannedCpf(cpf: string): Promise<BannedUser | null>;
  banUser(banData: BanUser & { bannedBy: number }): Promise<BannedUser>;
  getFalseReferralsCount(userId: number): Promise<number>;
  autoCheckForFraud(userId: number): Promise<boolean>; // Returns true if user was banned
  getAllBannedUsers(): Promise<BannedUser[]>;
  
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
  
  async createUser(userData: InsertUser) {
    const [user] = await db.insert(users)
      .values(userData)
      .returning({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        cpf: users.cpf,
        birthdate: users.birthdate,
        bank: users.bank,
        agency: users.agency,
        account: users.account,
        role: users.role,
        createdAt: users.createdAt
      });
    
    return user;
  }
  
  async getUserById(id: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    
    return user;
  }
  
  async getUserByUsername(username: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });
    
    return user;
  }
  
  async getAllUsers() {
    const allUsers = await db.query.users.findMany({
      orderBy: [asc(users.id)]
    });
    
    return allUsers.map(user => ({
      ...user,
      password: undefined // Don't send passwords to client
    }));
  }
  
  async createReferral(referralData: CreateReferral & { userId: number }) {
    const [referral] = await db.insert(referrals)
      .values(referralData)
      .returning();
    
    return referral;
  }
  
  async getReferralById(id: number) {
    const referral = await db.query.referrals.findFirst({
      where: eq(referrals.id, id),
      with: {
        user: true
      }
    });
    
    if (referral) {
      // Remove user password from response
      const { user, ...rest } = referral;
      const { password, ...userWithoutPassword } = user;
      return { ...rest, user: userWithoutPassword };
    }
    
    return null;
  }
  
  async getReferralsByUserId(userId: number) {
    const userReferrals = await db.query.referrals.findMany({
      where: eq(referrals.userId, userId),
      orderBy: [desc(referrals.createdAt)]
    });
    
    return userReferrals;
  }
  
  async getAllReferrals() {
    const allReferrals = await db.query.referrals.findMany({
      orderBy: [desc(referrals.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });
    
    return allReferrals;
  }
  
  async checkDuplicateReferral(phone?: string, licensePlate?: string) {
    const conditions = [];
    
    if (phone) {
      conditions.push(eq(referrals.phone, phone));
    }
    
    if (licensePlate) {
      conditions.push(eq(referrals.licensePlate, licensePlate));
    }
    
    if (conditions.length === 0) {
      return [];
    }
    
    const duplicates = await db.query.referrals.findMany({
      where: or(...conditions),
      with: {
        user: {
          columns: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });
    
    return duplicates;
  }
  
  async updateReferralStatus(
    id: number, 
    status: ReferralStatus, 
    commission?: number,
    notes?: string,
    paidAt?: Date
  ) {
    // Update data object
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };
    
    // Add commission if provided
    if (commission !== undefined) {
      updateData.commission = commission;
    }
    
    // Add notes if provided
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    // Set paidAt date if status is 'paid' and no specific date is provided
    if (status === 'paid') {
      updateData.paidAt = paidAt || new Date();
    }
    
    const [updatedReferral] = await db
      .update(referrals)
      .set(updateData)
      .where(eq(referrals.id, id))
      .returning();
    
    return updatedReferral;
  }

  // Compliance methods for fraud detection and prevention
  async checkBannedCpf(cpf: string): Promise<BannedUser | null> {
    const banned = await db.query.bannedUsers.findFirst({
      where: eq(bannedUsers.cpf, cpf),
      with: {
        bannedByUser: true
      }
    });
    
    return banned || null;
  }

  async banUser(banData: BanUser & { bannedBy: number }): Promise<BannedUser> {
    const [bannedUser] = await db
      .insert(bannedUsers)
      .values({
        cpf: banData.cpf,
        reason: banData.reason,
        notes: banData.notes,
        falseReferralsCount: banData.falseReferralsCount,
        bannedBy: banData.bannedBy
      })
      .returning();
    
    return bannedUser;
  }

  async getFalseReferralsCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(referrals)
      .where(
        and(
          eq(referrals.userId, userId),
          eq(referrals.status, 'rejected')
        )
      );
    
    return result[0]?.count || 0;
  }

  async autoCheckForFraud(userId: number): Promise<boolean> {
    // Get user data to extract CPF
    const user = await this.getUserById(userId);
    if (!user) return false;

    // Check if user is already banned
    const alreadyBanned = await this.checkBannedCpf(user.cpf);
    if (alreadyBanned) return true;

    // Count false/rejected referrals
    const falseCount = await this.getFalseReferralsCount(userId);
    
    // Auto-ban if user has 30 or more false referrals
    if (falseCount >= 30) {
      await this.banUser({
        cpf: user.cpf,
        reason: 'fraudulent_referrals',
        notes: `Banimento automático: ${falseCount} indicações rejeitadas/falsas`,
        falseReferralsCount: falseCount,
        bannedBy: 1 // Sistema automático (admin ID 1)
      });
      
      return true; // User was banned
    }
    
    return false; // User was not banned
  }

  async getAllBannedUsers(): Promise<BannedUser[]> {
    const banned = await db.query.bannedUsers.findMany({
      orderBy: desc(bannedUsers.bannedAt),
      with: {
        bannedByUser: true
      }
    });
    
    return banned;
  }
}

export const storage = new DatabaseStorage();
