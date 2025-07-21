import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  updateReferralStatusSchema,
  createReferralSchema,
  createCompanySchema,
  createWithdrawalRequestSchema,
  createSupportTicketSchema,
  createTicketResponseSchema,
  createCashFlowSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    next();
  };

  // Middleware to check admin role
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // Middleware to check analyst role
  const requireAnalyst = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || (req.user.role !== "analista" && req.user.role !== "admin")) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // Middleware to check promoter role
  const requirePromoter = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || (req.user.role !== "promotor" && req.user.role !== "admin")) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // === USER ROUTES ===
  
  // Get current user info
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });

  // Get users created by current user (for promoters)
  app.get("/api/users/my-team", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsersByCreator(req.user!.id);
      return res.json(users.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching team:", error);
      return res.status(500).json({ error: "Erro ao buscar equipe" });
    }
  });

  // Create new user (for promoters)
  app.post("/api/users", requirePromoter, async (req, res) => {
    try {
      const userData = {
        ...req.body,
        createdBy: req.user!.id,
        role: "indicador" // Promoters can only create indicators
      };
      
      const user = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  // === REFERRAL ROUTES ===
  
  // Get current user's referrals
  app.get("/api/referrals", requireAuth, async (req, res) => {
    try {
      const userReferrals = await storage.getReferralsByUserId(req.user!.id);
      return res.json(userReferrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Create a new referral
  app.post("/api/referrals", requireAuth, async (req, res) => {
    try {
      const validatedData = createReferralSchema.parse(req.body);
      
      // Check for duplicates
      const duplicates = await storage.checkDuplicateReferral(
        validatedData.phone,
        validatedData.licensePlate
      );
      
      if (duplicates.length > 0) {
        return res.status(400).json({ 
          error: "Já existe uma indicação com este telefone ou placa" 
        });
      }
      
      const referral = await storage.createReferral({
        ...validatedData,
        userId: req.user!.id
      });
      
      return res.status(201).json(referral);
    } catch (error) {
      console.error("Error creating referral:", error);
      return res.status(500).json({ error: "Erro ao criar indicação" });
    }
  });

  // Check for duplicate referrals
  app.post("/api/referrals/check-duplicate", requireAuth, async (req, res) => {
    try {
      const { phone, licensePlate } = req.body;
      const duplicates = await storage.checkDuplicateReferral(phone, licensePlate);
      
      return res.json({ 
        isDuplicate: duplicates.length > 0,
        duplicates 
      });
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return res.status(500).json({ error: "Erro ao verificar duplicatas" });
    }
  });

  // === COMPANY ROUTES ===
  
  // Get all companies
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      return res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      return res.status(500).json({ error: "Erro ao buscar empresas" });
    }
  });

  // Create new company (admin only)
  app.post("/api/companies", requireAdmin, async (req, res) => {
    try {
      const validatedData = createCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData.name);
      return res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      return res.status(500).json({ error: "Erro ao criar empresa" });
    }
  });

  // === WITHDRAWAL ROUTES ===
  
  // Get current user's withdrawal requests
  app.get("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawalRequestsByUserId(req.user!.id);
      return res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      return res.status(500).json({ error: "Erro ao buscar saques" });
    }
  });

  // Create withdrawal request
  app.post("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const validatedData = createWithdrawalRequestSchema.parse(req.body);
      
      // Check if user has enough balance
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      if (parseFloat(user.balance) < validatedData.amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }
      
      // Check if PIX key matches user's registered PIX
      if (validatedData.pixKey !== user.pixKey) {
        return res.status(400).json({ 
          error: "Chave PIX deve ser a mesma cadastrada no perfil" 
        });
      }
      
      const withdrawal = await storage.createWithdrawalRequest({
        ...validatedData,
        userId: req.user!.id
      });
      
      return res.status(201).json(withdrawal);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      return res.status(500).json({ error: "Erro ao criar solicitação de saque" });
    }
  });

  // === SUPPORT TICKET ROUTES ===
  
  // Get current user's tickets
  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getSupportTicketsByUserId(req.user!.id);
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      return res.status(500).json({ error: "Erro ao buscar tickets" });
    }
  });

  // Get ticket by ID
  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getSupportTicketById(parseInt(req.params.id));
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket não encontrado" });
      }
      
      // Check if user owns the ticket or is admin
      if (ticket.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      return res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      return res.status(500).json({ error: "Erro ao buscar ticket" });
    }
  });

  // Create support ticket
  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const validatedData = createSupportTicketSchema.parse(req.body);
      
      const ticket = await storage.createSupportTicket({
        ...validatedData,
        userId: req.user!.id
      });
      
      return res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      return res.status(500).json({ error: "Erro ao criar ticket" });
    }
  });

  // Create ticket response
  app.post("/api/tickets/:id/responses", requireAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSupportTicketById(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket não encontrado" });
      }
      
      // Check if user owns the ticket or is admin
      if (ticket.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const response = await storage.createTicketResponse({
        ticketId,
        userId: req.user!.id,
        message: req.body.message,
        isInternal: req.body.isInternal || false
      });
      
      return res.status(201).json(response);
    } catch (error) {
      console.error("Error creating ticket response:", error);
      return res.status(500).json({ error: "Erro ao criar resposta" });
    }
  });

  // === ADMIN ROUTES ===
  
  // Get all users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(users.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Get all referrals
  app.get("/api/admin/referrals", requireAdmin, async (req, res) => {
    try {
      const allReferrals = await storage.getAllReferrals();
      return res.json(allReferrals);
    } catch (error) {
      console.error("Error fetching all referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Update referral status
  app.patch("/api/admin/referrals/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateReferralStatusSchema.parse(req.body);
      
      const updatedReferral = await storage.updateReferralStatus(
        parseInt(id),
        validatedData.status,
        validatedData.notes
      );
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral:", error);
      return res.status(500).json({ error: "Erro ao atualizar indicação" });
    }
  });

  // Get all withdrawal requests
  app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
    try {
      const withdrawals = await storage.getAllWithdrawalRequests();
      return res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      return res.status(500).json({ error: "Erro ao buscar saques" });
    }
  });

  // Update withdrawal status
  app.patch("/api/admin/withdrawals/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const updated = await storage.updateWithdrawalStatus(
        parseInt(id),
        status,
        req.user!.id,
        notes
      );
      
      return res.json(updated);
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      return res.status(500).json({ error: "Erro ao atualizar saque" });
    }
  });

  // Get cash flow entries
  app.get("/api/admin/cash-flow", requireAdmin, async (req, res) => {
    try {
      const entries = await storage.getCashFlowEntries();
      const balance = await storage.getCurrentBalance();
      
      return res.json({ entries, balance });
    } catch (error) {
      console.error("Error fetching cash flow:", error);
      return res.status(500).json({ error: "Erro ao buscar fluxo de caixa" });
    }
  });

  // Create cash flow entry
  app.post("/api/admin/cash-flow", requireAdmin, async (req, res) => {
    try {
      const validatedData = createCashFlowSchema.parse(req.body);
      
      const entry = await storage.createCashFlowEntry({
        ...validatedData,
        createdBy: req.user!.id
      });
      
      return res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating cash flow entry:", error);
      return res.status(500).json({ error: "Erro ao criar entrada no fluxo de caixa" });
    }
  });

  // Get all support tickets
  app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      return res.status(500).json({ error: "Erro ao buscar tickets" });
    }
  });

  // Update ticket status
  app.patch("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const updated = await storage.updateTicketStatus(parseInt(id), status);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating ticket:", error);
      return res.status(500).json({ error: "Erro ao atualizar ticket" });
    }
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}