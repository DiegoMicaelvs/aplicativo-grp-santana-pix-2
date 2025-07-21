import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// User roles
export type UserRole = "indicador" | "promotor" | "admin" | "analista";
export type AnalystLevel = 1 | 2 | 3;

// User types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // email usado como username
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  cpf: text("cpf").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  shirtSize: text("shirt_size").notNull(), // P, M, G, GG, etc
  pixKey: text("pix_key").notNull(),
  role: text("role").default("indicador").notNull().$type<UserRole>(),
  analystLevel: integer("analyst_level").$type<AnalystLevel>(), // Apenas para analistas
  permissions: jsonb("permissions").$type<string[]>(), // Permissões específicas para analistas
  createdBy: integer("created_by").references(() => users.id), // Quem cadastrou este usuário
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(), // Saldo disponível
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(), // Total ganho
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Companies for referrals
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral statuses
export type ReferralStatus = "pending" | "validated" | "converted" | "rejected" | "paid";

// Referrals table
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  licensePlate: text("license_plate").notNull(),
  hasInsurance: boolean("has_insurance").notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  status: text("status").default("pending").notNull().$type<ReferralStatus>(),
  commissionIndicator: decimal("commission_indicator", { precision: 10, scale: 2 }).default("0.00"),
  commissionPromoter: decimal("commission_promoter", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Withdrawal requests
export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  pixKey: text("pix_key").notNull(),
  status: text("status").default("pending").notNull().$type<WithdrawalStatus>(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
  notes: text("notes"),
});

// Cash flow control
export const cashFlow = pgTable("cash_flow", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().$type<"inflow" | "outflow">(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  relatedWithdrawalId: integer("related_withdrawal_id").references(() => withdrawalRequests.id),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(), // Saldo após a operação
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Support tickets
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(), // Formato: YYYYMMDD-XXXX
  userId: integer("user_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").default("open").notNull().$type<TicketStatus>(),
  attachments: jsonb("attachments").$type<string[]>(), // URLs dos arquivos anexados
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ticket responses
export const ticketResponses = pgTable("ticket_responses", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(), // Notas internas da equipe
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  referrals: many(referrals),
  createdUsers: many(users, { relationName: "createdByRelation" }),
  creator: one(users, {
    fields: [users.createdBy],
    references: [users.id],
    relationName: "createdByRelation"
  }),
  withdrawalRequests: many(withdrawalRequests),
  supportTickets: many(supportTickets),
  ticketResponses: many(ticketResponses),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  user: one(users, {
    fields: [referrals.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [referrals.companyId],
    references: [companies.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  referrals: many(referrals),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, {
    fields: [withdrawalRequests.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [withdrawalRequests.processedBy],
    references: [users.id],
  }),
}));

export const cashFlowRelations = relations(cashFlow, ({ one }) => ({
  createdByUser: one(users, {
    fields: [cashFlow.createdBy],
    references: [users.id],
  }),
  withdrawal: one(withdrawalRequests, {
    fields: [cashFlow.relatedWithdrawalId],
    references: [withdrawalRequests.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  responses: many(ticketResponses),
}));

export const ticketResponsesRelations = relations(ticketResponses, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketResponses.ticketId],
    references: [supportTickets.id],
  }),
  user: one(users, {
    fields: [ticketResponses.userId],
    references: [users.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  fullName: (schema) => schema.min(1, "Nome completo é obrigatório"),
  username: (schema) => schema.email("Email inválido").min(1, "Email é obrigatório"),
  password: (schema) => schema.min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: (schema) => schema.min(11, "CPF inválido").max(14, "CPF inválido"),
  email: (schema) => schema.email("Email inválido").min(1, "Email é obrigatório"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  address: (schema) => schema.min(5, "Endereço é obrigatório"),
  shirtSize: (schema) => schema.min(1, "Tamanho da camisa é obrigatório"),
  pixKey: (schema) => schema.min(3, "Chave PIX é obrigatória"),
}).omit({ id: true, createdAt: true, updatedAt: true, balance: true, totalEarnings: true });

export const createReferralSchema = createInsertSchema(referrals, {
  fullName: (schema) => schema.min(1, "Nome completo é obrigatório"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  licensePlate: (schema) => schema.min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"),
}).omit({ id: true, userId: true, status: true, commissionIndicator: true, commissionPromoter: true, createdAt: true, updatedAt: true, notes: true });

export const updateReferralStatusSchema = z.object({
  status: z.enum(["pending", "validated", "converted", "rejected", "paid"]),
  notes: z.string().optional(),
});

export const createCompanySchema = createInsertSchema(companies, {
  name: (schema) => schema.min(1, "Nome da empresa é obrigatório"),
}).omit({ id: true, createdAt: true });

export const createWithdrawalRequestSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
});

export const createSupportTicketSchema = z.object({
  subject: z.string().min(1, "Assunto é obrigatório"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  attachments: z.array(z.string()).optional(),
});

export const createTicketResponseSchema = z.object({
  ticketId: z.number(),
  message: z.string().min(1, "Mensagem é obrigatória"),
  isInternal: z.boolean().optional(),
});

export const createCashFlowSchema = z.object({
  type: z.enum(["inflow", "outflow"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  relatedWithdrawalId: z.number().optional(),
});

// Login data type
export const loginSchema = z.object({
  username: z.string().min(1, "Email é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Types for use in the application
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CreateReferral = z.infer<typeof createReferralSchema>;
export type Referral = typeof referrals.$inferSelect;
export type UpdateReferralStatus = z.infer<typeof updateReferralStatusSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type Company = typeof companies.$inferSelect;
export type CreateCompany = z.infer<typeof createCompanySchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type CreateWithdrawalRequest = z.infer<typeof createWithdrawalRequestSchema>;
export type CashFlow = typeof cashFlow.$inferSelect;
export type CreateCashFlow = z.infer<typeof createCashFlowSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type CreateSupportTicket = z.infer<typeof createSupportTicketSchema>;
export type TicketResponse = typeof ticketResponses.$inferSelect;
export type CreateTicketResponse = z.infer<typeof createTicketResponseSchema>;
