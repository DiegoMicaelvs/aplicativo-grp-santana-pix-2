import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// User types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  cpf: text("cpf").notNull().unique(),
  birthdate: text("birthdate").notNull(),
  bank: text("bank"),
  agency: text("agency"),
  account: text("account"),
  role: text("role").default("referrer").notNull(), // "referrer" or "admin"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Referral statuses: pending, processing, converted, rejected, validated, paid
export type ReferralStatus = "pending" | "processing" | "converted" | "rejected" | "validated" | "paid";

// Referrals table
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().unique(),
  licensePlate: text("license_plate").notNull().unique(),
  comments: text("comments"),
  status: text("status").default("pending").notNull().$type<ReferralStatus>(),
  commission: decimal("commission", { precision: 10, scale: 2 }),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  referrals: many(referrals),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  user: one(users, {
    fields: [referrals.userId],
    references: [users.id],
  }),
}));

// Tabela de compliance para usuários banidos
export const bannedUsers = pgTable("banned_users", {
  id: serial("id").primaryKey(),
  cpf: text("cpf").notNull().unique(),
  reason: text("reason").notNull(), // "fraudulent_referrals", "multiple_accounts", etc.
  bannedAt: timestamp("banned_at").defaultNow().notNull(),
  bannedBy: integer("banned_by").references(() => users.id), // Admin que aplicou o banimento
  falseReferralsCount: integer("false_referrals_count").default(0),
  notes: text("notes"), // Observações do admin
});

export const bannedUsersRelations = relations(bannedUsers, ({ one }) => ({
  bannedByUser: one(users, { fields: [bannedUsers.bannedBy], references: [users.id] }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  firstName: (schema) => schema.min(1, "Nome é obrigatório"),
  lastName: (schema) => schema.min(1, "Sobrenome é obrigatório"),
  username: (schema) => schema.email("Email inválido").min(1, "Email é obrigatório"),
  password: (schema) => schema.min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: (schema) => schema.min(11, "CPF inválido").max(14, "CPF inválido"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  birthdate: (schema) => schema.refine((date) => {
    const today = new Date();
    const birthDate = new Date(date);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18;
  }, "Você deve ter pelo menos 18 anos para se cadastrar"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const createReferralSchema = createInsertSchema(referrals, {
  firstName: (schema) => schema.min(1, "Nome é obrigatório"),
  lastName: (schema) => schema.min(1, "Sobrenome é obrigatório"),
  email: (schema) => schema.email("Email inválido").min(1, "Email é obrigatório"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  licensePlate: (schema) => schema.min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"),
}).omit({ id: true, userId: true, status: true, commission: true, paidAt: true, createdAt: true, updatedAt: true, notes: true });

export const updateReferralStatusSchema = z.object({
  status: z.enum(["pending", "processing", "converted", "rejected", "validated", "paid"]),
  commission: z.number().optional(),
  notes: z.string().optional(),
  paidAt: z.union([
    z.date(),
    z.string().transform((str) => new Date(str))
  ]).optional(),
});

// Login data type
export const loginSchema = z.object({
  username: z.string().min(1, "Email é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Schema para banimento de usuários
export const banUserSchema = z.object({
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  reason: z.string().min(1, "Motivo é obrigatório"),
  notes: z.string().optional(),
  falseReferralsCount: z.number().default(0),
});

// Types for use in the application
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CreateReferral = z.infer<typeof createReferralSchema>;
export type Referral = typeof referrals.$inferSelect;
export type UpdateReferralStatus = z.infer<typeof updateReferralStatusSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type BanUser = z.infer<typeof banUserSchema>;
export type BannedUser = typeof bannedUsers.$inferSelect;
