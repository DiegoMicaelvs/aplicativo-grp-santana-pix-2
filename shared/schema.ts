import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// User roles
export type UserRole = "indicador" | "promotor" | "admin" | "analista" | "vendedor" | "gerente";
export type AnalystLevel = 1 | 2 | 3;

// Analyst permissions
export type AnalystPermission = 
  | "view_referrals" 
  | "edit_referral_status" 
  | "view_users" 
  | "manage_withdrawals" 
  | "view_reports" 
  | "manage_companies"
  | "create_indicadores"
  | "create_promotores";

// Manager permissions
export type ManagerPermission = 
  | "view_all_referrals"
  | "edit_all_referrals"
  | "view_all_users"
  | "manage_all_users"
  | "view_all_reports"
  | "manage_analysts"
  | "manage_promoters"
  | "manage_withdrawals"
  | "view_financial_reports"
  | "manage_companies"
  | "audit_access";

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
  permissions: jsonb("permissions").$type<AnalystPermission[] | ManagerPermission[]>(), // Permissões específicas para analistas e gerentes
  createdBy: integer("created_by"), // Quem cadastrou este usuário
  promoterId: integer("promoter_id"), // ID do promotor que cadastrou este indicador
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(), // Saldo disponível
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(), // Total ganho
  mustChangePassword: boolean("must_change_password").default(false).notNull(), // Força alteração de senha no próximo login
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
export type ReferralStatus = "pending" | "analyzing" | "validated" | "converted" | "rejected" | "paid";

// Referrals table
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // Indicador que fez a indicação
  createdBy: integer("created_by").references(() => users.id).notNull(), // Usuário que criou o registro
  promoterId: integer("promoter_id").references(() => users.id), // Promotor responsável pela equipe
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  licensePlate: text("license_plate").notNull(),
  hasInsurance: boolean("has_insurance").notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  status: text("status").default("pending").notNull().$type<ReferralStatus>(),
  commissionIndicator: decimal("commission_indicator", { precision: 10, scale: 2 }).default("0.00"),
  commissionPromoter: decimal("commission_promoter", { precision: 10, scale: 2 }).default("0.00"),
  statusHistory: jsonb("status_history").$type<{status: string, changedBy: number, changedAt: string, notes?: string}[]>(), // Histórico de mudanças de status
  // Campos de validação
  vehicleBrand: text("vehicle_brand"), // Marca do veículo
  vehicleModel: text("vehicle_model"), // Modelo do veículo  
  vehicleYear: text("vehicle_year"), // Ano do veículo
  nameCorrect: boolean("name_correct"), // Nome está correto?
  plateCorrect: boolean("plate_correct"), // Placa está correta?
  phoneCorrect: boolean("phone_correct"), // Telefone está correto?
  validationNotes: text("validation_notes"), // Observações da validação
  validatedBy: integer("validated_by").references(() => users.id), // Quem fez a validação
  validatedAt: timestamp("validated_at"), // Quando foi validado
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
  cpfKey: text("cpf_key").notNull(), // CPF associado à chave PIX
  requestType: text("request_type").notNull().$type<"indicador" | "promotor">(), // Tipo de saque
  status: text("status").default("pending").notNull().$type<WithdrawalStatus>(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
});

// Audit trail for all system actions
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // Quem realizou a ação
  action: text("action").notNull(), // Tipo de ação (create, update, delete, login, etc)
  entityType: text("entity_type").notNull(), // Tipo de entidade (user, referral, withdrawal, etc)
  entityId: integer("entity_id"), // ID da entidade afetada
  oldValues: jsonb("old_values"), // Valores anteriores (para updates)
  newValues: jsonb("new_values"), // Novos valores
  ipAddress: text("ip_address"), // IP de onde veio a ação
  userAgent: text("user_agent"), // User agent do navegador
  details: text("details"), // Detalhes adicionais
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cash flow control - Sistema de caixa
export const cashFlow = pgTable("cash_flow", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().$type<"inflow" | "outflow">(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  relatedWithdrawalId: integer("related_withdrawal_id").references(() => withdrawalRequests.id),
  relatedReferralId: integer("related_referral_id").references(() => referrals.id),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(), // Saldo após a operação
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral conversation system for tracking history and analyst observations
export type ConversationMessageType = "comment" | "status_change" | "validation" | "system";

export const referralConversations = pgTable("referral_conversations", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").references(() => referrals.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // Quem escreveu a mensagem
  message: text("message").notNull(),
  messageType: text("message_type").default("comment").notNull().$type<ConversationMessageType>(),
  isInternal: boolean("is_internal").default(false).notNull(), // Visível apenas para analistas/admins
  metadata: jsonb("metadata").$type<{oldStatus?: string, newStatus?: string, validationScore?: number}>(), // Dados extras sobre mudanças
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Support tickets
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "bug" | "feature" | "question" | "other";

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(), // Formato: YYYYMMDD-XXXX
  userId: integer("user_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").default("medium").notNull().$type<TicketPriority>(),
  category: text("category").default("question").notNull().$type<TicketCategory>(),
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
  isAdminResponse: boolean("is_admin_response").default(false).notNull(), // Se é resposta de admin
  attachments: jsonb("attachments").$type<string[]>(), // URLs dos arquivos anexados
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sales Pipeline - CRM for Vendedor role
export type SalesLeadStatus = "novo" | "em_negociacao" | "proposta_enviada" | "negocio_fechado" | "perdido" | "reagendado";
export type SalesLeadSource = "indicacao" | "prospeccao" | "marketing" | "referencia";

export const salesLeads = pgTable("sales_leads", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").references(() => referrals.id), // Vinculado a uma indicação (se aplicável)
  vendedorId: integer("vendedor_id").references(() => users.id).notNull(), // Vendedor responsável
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  licensePlate: text("license_plate"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  currentInsurer: text("current_insurer"),
  hasInsurance: boolean("has_insurance").default(false),
  status: text("status").default("novo").notNull().$type<SalesLeadStatus>(),
  source: text("source").default("indicacao").notNull().$type<SalesLeadSource>(),
  proposalValue: decimal("proposal_value", { precision: 10, scale: 2 }),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0.00"),
  finalValue: decimal("final_value", { precision: 10, scale: 2 }),
  expectedCommission: decimal("expected_commission", { precision: 10, scale: 2 }),
  actualCommission: decimal("actual_commission", { precision: 10, scale: 2 }),
  proposalAttachments: jsonb("proposal_attachments").$type<string[]>(), // URLs dos arquivos de proposta
  notes: text("notes"),
  nextFollowUp: timestamp("next_follow_up"), // Próximo lembrete/retorno
  followUpReason: text("follow_up_reason"), // Motivo do reagendamento
  closedAt: timestamp("closed_at"), // Data de fechamento (ganho ou perdido)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sales Activities - Timeline de atividades do lead
export type SalesActivityType = "call" | "email" | "meeting" | "proposal" | "follow_up" | "note" | "status_change";

export const salesActivities = pgTable("sales_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => salesLeads.id).notNull(),
  vendedorId: integer("vendedor_id").references(() => users.id).notNull(),
  activityType: text("activity_type").notNull().$type<SalesActivityType>(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledFor: timestamp("scheduled_for"), // Para atividades agendadas
  completedAt: timestamp("completed_at"), // Quando foi concluída
  attachments: jsonb("attachments").$type<string[]>(), // URLs dos arquivos
  metadata: jsonb("metadata").$type<{
    oldStatus?: string,
    newStatus?: string,
    callDuration?: number,
    outcome?: string
  }>(), // Dados específicos do tipo de atividade
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Calendar reminders for vendors
export const salesReminders = pgTable("sales_reminders", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => salesLeads.id).notNull(),
  vendedorId: integer("vendedor_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  reminderDate: timestamp("reminder_date").notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
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
  // Promoter relationships
  indicadores: many(users, { relationName: "promoterRelation" }), // Indicadores sob este promotor
  promoter: one(users, {
    fields: [users.promoterId],
    references: [users.id],
    relationName: "promoterRelation"
  }),
  withdrawalRequests: many(withdrawalRequests),
  supportTickets: many(supportTickets),
  ticketResponses: many(ticketResponses),
}));

export const referralsRelations = relations(referrals, ({ one, many }) => ({
  user: one(users, {
    fields: [referrals.userId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [referrals.createdBy],
    references: [users.id],
  }),
  promoter: one(users, {
    fields: [referrals.promoterId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [referrals.companyId],
    references: [companies.id],
  }),
  conversations: many(referralConversations),
}));

export const referralConversationsRelations = relations(referralConversations, ({ one }) => ({
  referral: one(referrals, {
    fields: [referralConversations.referralId],
    references: [referrals.id],
  }),
  user: one(users, {
    fields: [referralConversations.userId],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
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

// Sales Relations
export const salesLeadsRelations = relations(salesLeads, ({ one, many }) => ({
  vendedor: one(users, {
    fields: [salesLeads.vendedorId],
    references: [users.id]
  }),
  referral: one(referrals, {
    fields: [salesLeads.referralId],
    references: [referrals.id]
  }),
  activities: many(salesActivities),
  reminders: many(salesReminders)
}));

export const salesActivitiesRelations = relations(salesActivities, ({ one }) => ({
  lead: one(salesLeads, {
    fields: [salesActivities.leadId],
    references: [salesLeads.id]
  }),
  vendedor: one(users, {
    fields: [salesActivities.vendedorId],
    references: [users.id]
  })
}));

export const salesRemindersRelations = relations(salesReminders, ({ one }) => ({
  lead: one(salesLeads, {
    fields: [salesReminders.leadId],
    references: [salesLeads.id]
  }),
  vendedor: one(users, {
    fields: [salesReminders.vendedorId],
    references: [users.id]
  })
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  username: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  address: z.string().min(5, "Endereço é obrigatório"),
  shirtSize: z.string().min(1, "Tamanho da camisa é obrigatório"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
}).omit({ id: true, createdAt: true, updatedAt: true, balance: true, totalEarnings: true });

export const createReferralSchema = createInsertSchema(referrals, {
  fullName: (schema) => schema.min(1, "Nome completo é obrigatório"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  licensePlate: (schema) => schema.min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"),
  companyId: z.coerce.number().positive("Empresa é obrigatória"),
}).omit({ id: true, userId: true, createdBy: true, promoterId: true, status: true, commissionIndicator: true, commissionPromoter: true, createdAt: true, updatedAt: true, notes: true, statusHistory: true });

// Audit log schema
export const createAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });

export const updateReferralStatusSchema = z.object({
  status: z.enum(["pending", "analyzing", "validated", "converted", "rejected", "paid"]),
  notes: z.string().optional(),
});

export const createCompanySchema = createInsertSchema(companies, {
  name: (schema) => schema.min(1, "Nome da empresa é obrigatório"),
}).omit({ id: true, createdAt: true });

export const createWithdrawalRequestSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
  cpfKey: z.string().min(11, "CPF é obrigatório").max(14, "CPF inválido"),
});

export const createSupportTicketSchema = z.object({
  subject: z.string().min(5, "Assunto deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category: z.enum(["bug", "feature", "question", "other"]).default("question"),
  attachments: z.array(z.string()).optional(),
});

export const createTicketResponseSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória"),
  isAdminResponse: z.boolean().default(false),
  attachments: z.array(z.string()).optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export const createCashFlowSchema = z.object({
  type: z.enum(["inflow", "outflow"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  relatedWithdrawalId: z.number().optional(),
});

// Schema para criar indicador (usado por promotores)
export const createIndicadorSchema = insertUserSchema.extend({
  role: z.literal("indicador"),
  promoterId: z.number().optional(), // Será preenchido automaticamente pelo promotor logado
});

// Schema para conversas de indicações
export const createReferralConversationSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória"),
  messageType: z.enum(["comment", "status_change", "validation", "system"]).default("comment"),
  isInternal: z.boolean().default(false),
  metadata: z.object({
    oldStatus: z.string().optional(),
    newStatus: z.string().optional(),
    validationScore: z.number().optional(),
  }).optional(),
});

// Schema para configurar permissões de analista
export const updateAnalystPermissionsSchema = z.object({
  analystLevel: z.coerce.number().int().min(1).max(3),
  permissions: z.array(z.enum([
    "view_referrals", 
    "edit_referral_status", 
    "view_users", 
    "manage_withdrawals", 
    "view_reports", 
    "manage_companies"
  ]))
});

// Schema para validação de indicação
export const validateReferralSchema = z.object({
  vehicleBrand: z.string().min(1, "Marca do veículo é obrigatória"),
  vehicleModel: z.string().min(1, "Modelo do veículo é obrigatório"),
  vehicleYear: z.string().min(4, "Ano do veículo é obrigatório").max(4, "Ano deve ter 4 dígitos"),
  nameCorrect: z.boolean(),
  plateCorrect: z.boolean(),
  phoneCorrect: z.boolean(),
  validationNotes: z.string().optional(),
});

// Schema para atualizar status de indicação com comissões
export const updateReferralWithCommissionSchema = z.object({
  status: z.enum(["pending", "analyzing", "validated", "converted", "rejected", "paid"]),
  notes: z.string().optional(),
});

// Login data type
export const loginSchema = z.object({
  username: z.string().min(1, "Email é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Sales Schemas
export const createSalesLeadSchema = createInsertSchema(salesLeads, {
  fullName: (schema) => schema.min(1, "Nome completo é obrigatório"),
  phone: (schema) => schema.min(10, "Telefone inválido").max(15, "Telefone inválido"),
  proposalValue: z.coerce.number().positive("Valor da proposta deve ser positivo").optional(),
  discountPercent: z.coerce.number().min(0).max(100, "Desconto deve estar entre 0% e 100%").optional(),
  finalValue: z.coerce.number().positive("Valor final deve ser positivo").optional(),
  expectedCommission: z.coerce.number().min(0, "Comissão esperada deve ser positiva").optional(),
}).omit({ id: true, vendedorId: true, createdAt: true, updatedAt: true, closedAt: true, actualCommission: true }).extend({
  licensePlate: z.string().optional(),
  hasInsurance: z.boolean().optional(),
  source: z.enum(["manual", "indicacao", "website", "phone", "referral"]).default("manual"),
  status: z.enum(["novo", "em_negociacao", "proposta_enviada", "negocio_fechado", "perdido", "reagendado"]).default("novo"),
  notes: z.string().optional()
});

export const updateSalesLeadSchema = z.object({
  status: z.enum(["novo", "em_negociacao", "proposta_enviada", "negocio_fechado", "perdido", "reagendado"]),
  proposalValue: z.coerce.number().positive().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  finalValue: z.coerce.number().positive().optional(),
  expectedCommission: z.coerce.number().min(0).optional(),
  actualCommission: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  nextFollowUp: z.string().optional(), // ISO date string
  followUpReason: z.string().optional(),
});

export const createSalesActivitySchema = createInsertSchema(salesActivities, {
  title: (schema) => schema.min(1, "Título é obrigatório"),
  activityType: z.enum(["call", "email", "meeting", "proposal", "follow_up", "note", "status_change"]),
}).omit({ id: true, leadId: true, vendedorId: true, createdAt: true, completedAt: true });

export const createSalesReminderSchema = createInsertSchema(salesReminders, {
  title: (schema) => schema.min(1, "Título é obrigatório"),
  reminderDate: z.string().min(1, "Data do lembrete é obrigatória"), // ISO date string
}).omit({ id: true, leadId: true, vendedorId: true, createdAt: true, completedAt: true, isCompleted: true });

// Types for use in the application
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CreateReferral = z.infer<typeof createReferralSchema>;
export type SalesLead = typeof salesLeads.$inferSelect;
export type CreateSalesLead = z.infer<typeof createSalesLeadSchema>;
export type UpdateSalesLead = z.infer<typeof updateSalesLeadSchema>;
export type SalesActivity = typeof salesActivities.$inferSelect;
export type CreateSalesActivity = z.infer<typeof createSalesActivitySchema>;
export type SalesReminder = typeof salesReminders.$inferSelect;
export type CreateSalesReminder = z.infer<typeof createSalesReminderSchema>;
export type Referral = typeof referrals.$inferSelect;
export type UpdateReferralStatus = z.infer<typeof updateReferralStatusSchema>;
export type UpdateReferralWithCommission = z.infer<typeof updateReferralWithCommissionSchema>;
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
export type CreateIndicador = z.infer<typeof createIndicadorSchema>;
export type UpdateAnalystPermissions = z.infer<typeof updateAnalystPermissionsSchema>;
export type ReferralConversation = typeof referralConversations.$inferSelect;
export type CreateReferralConversation = z.infer<typeof createReferralConversationSchema>;
