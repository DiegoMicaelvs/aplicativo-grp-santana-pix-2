import { db } from "@db";
import { eq, desc, asc } from "drizzle-orm";
import { users, referrals } from "@shared/schema";
import { InsertUser, CreateReferral, ReferralStatus } from "@shared/schema";
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
  updateReferralStatus(
    id: number, 
    status: ReferralStatus, 
    commission?: number,
    notes?: string
  ): Promise<any>;
  
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
  
  async updateReferralStatus(
    id: number, 
    status: ReferralStatus, 
    commission?: number,
    notes?: string
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
    
    // Set paidAt date if status is converted
    if (status === 'converted') {
      updateData.paidAt = new Date();
    }
    
    const [updatedReferral] = await db
      .update(referrals)
      .set(updateData)
      .where(eq(referrals.id, id))
      .returning();
    
    return updatedReferral;
  }
}

export const storage = new DatabaseStorage();
