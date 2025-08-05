import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { 
  updateReferralStatusSchema,
  updateReferralWithCommissionSchema,
  createReferralSchema,
  createCompanySchema,
  createWithdrawalRequestSchema,
  createSupportTicketSchema,
  createTicketResponseSchema,
  createCashFlowSchema,
  createIndicadorSchema,
  updateAnalystPermissionsSchema,
  createReferralConversationSchema,
  validateReferralSchema,
  type AnalystPermission,
  type ManagerPermission
} from "@shared/schema";
import { 
  registerCrossAppValidationRoutes,
  validateUserDuplicates,
  validateReferralDuplicates 
} from "./crossAppValidation";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Register cross-app validation routes
  registerCrossAppValidationRoutes(app);

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

  // Middleware to check vendedor role
  const requireVendedor = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || (req.user.role !== "vendedor" && req.user.role !== "admin")) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // Middleware to check manager role
  const requireManager = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || (req.user.role !== "gerente" && req.user.role !== "admin")) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // Middleware to check analyst permissions
  const requireAnalystPermission = (permission: AnalystPermission) => {
    return (req: any, res: any, next: any) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      
      // Admin has all permissions
      if (req.user.role === "admin") {
        return next();
      }
      
      // Check analyst permissions
      if (req.user.role === "analista") {
        const userPermissions = req.user.permissions || [];
        if (userPermissions.includes(permission)) {
          return next();
        }
      }
      
      return res.status(403).json({ error: "Permissão insuficiente" });
    };
  };

  // === USER ROUTES ===
  
  // Get current user info
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Calculate real total earnings from converted/paid referrals
      const userReferrals = await storage.getReferralsByUserId(user.id);
      let realTotalEarnings = 0;
      
      // Sum commissions only from paid referrals
      for (const referral of userReferrals) {
        if (referral.status === 'paid') {
          realTotalEarnings += parseFloat(referral.commissionIndicator || '0');
        }
      }
      
      // If user is a promoter, also calculate promoter commissions
      if (user.role === 'promotor') {
        const promoterReferrals = await storage.getReferralsByTeam(user.id);
        for (const referral of promoterReferrals) {
          if (referral.status === 'converted' || referral.status === 'paid') {
            realTotalEarnings += parseFloat(referral.commissionPromoter || '0');
          }
        }
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      
      // Override totalEarnings with the real calculated value
      return res.json({
        ...userWithoutPassword,
        totalEarnings: realTotalEarnings.toFixed(2)
      });
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



  // Get indicadores under a promoter
  app.get("/api/users/indicadores", requirePromoter, async (req, res) => {
    try {
      const indicadores = await storage.getIndicadoresByPromoter(req.user!.id);
      return res.json(indicadores.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching indicadores:", error);
      return res.status(500).json({ error: "Erro ao buscar indicadores" });
    }
  });

  // === REFERRAL ROUTES ===
  
  // Get current user's referrals
  app.get("/api/referrals", requireAuth, async (req, res) => {
    try {
      let userReferrals;
      
      // Para todos os perfis, mostrar indicações atribuídas a eles (userId)
      userReferrals = await storage.getReferralsByUserId(req.user!.id);
      
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
      
      // === SISTEMA DE SEGURANÇA PARA LEADS ===
      
      // 1. Verificar limite de 30 referrals por dia
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayReferrals = await storage.getTodayReferralsByUserId(req.user!.id, today);
      
      if (todayReferrals.length >= 30) {
        return res.status(400).json({ 
          error: "Limite diário atingido",
          details: `Você já cadastrou ${todayReferrals.length} clientes hoje. Limite máximo: 30 por dia.`
        });
      }
      
      // 2. Verificar duplicatas locais (placa e telefone)
      const duplicates = await storage.checkDuplicateReferralWithOwner(
        validatedData.phone,
        validatedData.licensePlate
      );
      
      if (duplicates.length > 0) {
        const duplicate = duplicates[0];
        const ownerFirstName = duplicate.createdByFirstName || 'Usuário';
        const ownerState = duplicate.createdByState || '';
        const ownerInfo = ownerState ? `${ownerFirstName} (${ownerState})` : ownerFirstName;
        
        let errorMessage = "Cadastro duplicado encontrado:\n";
        if (duplicate.phone && duplicate.phone.toLowerCase() === validatedData.phone.toLowerCase()) {
          errorMessage += `• Telefone ${validatedData.phone} já cadastrado por ${ownerInfo}\n`;
        }
        if (duplicate.licensePlate && duplicate.licensePlate.toLowerCase() === validatedData.licensePlate.toLowerCase()) {
          errorMessage += `• Placa ${validatedData.licensePlate} já cadastrada por ${ownerInfo}\n`;
        }
        errorMessage += `Data do primeiro cadastro: ${new Date(duplicate.createdAt).toLocaleDateString('pt-BR')}`;
        
        return res.status(400).json({ 
          error: "Duplicata encontrada",
          details: errorMessage,
          duplicatedBy: ownerInfo,
          originalDate: duplicate.createdAt
        });
      }

      // 3. Verificar duplicatas em outros aplicativos (validação cruzada)
      const crossAppValidation = await validateReferralDuplicates({
        phone: validatedData.phone,
        licensePlate: validatedData.licensePlate
      });
      
      if (crossAppValidation.isDuplicate) {
        const validationError = crossAppValidation.message || 
          "Esta indicação já foi cadastrada em outro aplicativo";
        
        return res.status(400).json({
          error: "Indicação duplicada em outro app",
          details: validationError,
          crossAppDuplicate: true
        });
      }
      
      const referral = await storage.createReferral({
        ...validatedData,
        userId: req.user!.id,
        createdBy: req.user!.id
      });

      // Send SMS notification to user about new referral
      const user = await storage.getUserById(req.user!.id);
      if (user?.phone) {
        try {
          const { sendReferralNotification } = await import('./sms-service');
          await sendReferralNotification(
            user.phone,
            user.fullName,
            referral.id
          );
          console.log(`SMS notification sent to ${user.phone} for new referral #${referral.id}`);
        } catch (smsError) {
          console.log('SMS notification failed (non-critical):', smsError);
          // Don't fail the referral creation if SMS fails
        }
      }
      
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
      const duplicates = await storage.checkDuplicateReferralWithOwner(phone, licensePlate);
      
      return res.json({ 
        isDuplicate: duplicates.length > 0,
        duplicates: duplicates.map(duplicate => ({
          ...duplicate,
          ownerFirstName: duplicate.createdByFirstName,
          ownerState: duplicate.createdByState
        }))
      });
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return res.status(500).json({ error: "Erro ao verificar duplicatas" });
    }
  });

  // Get today's referral stats for current user
  app.get("/api/referrals/today-stats", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayReferrals = await storage.getTodayReferralsByUserId(req.user!.id, today);
      
      return res.json({
        count: todayReferrals.length,
        limit: 30,
        remaining: Math.max(0, 30 - todayReferrals.length)
      });
    } catch (error) {
      console.error("Error fetching today stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // === REFERRAL CONVERSATION ROUTES ===
  
  // Get conversations for a referral
  app.get("/api/referrals/:id/conversations", requireAuth, async (req, res) => {
    try {
      const referralId = parseInt(req.params.id);
      const referral = await storage.getReferralById(referralId);
      
      if (!referral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Check if user has access to this referral
      const canAccess = req.user!.role === "admin" || 
                       req.user!.role === "analista" ||
                       referral.userId === req.user!.id ||
                       (req.user!.role === "promotor" && referral.promoterId === req.user!.id);
      
      if (!canAccess) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const conversations = await storage.getReferralConversations(referralId, req.user!.role);
      return res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return res.status(500).json({ error: "Erro ao buscar conversas" });
    }
  });

  // Add conversation message to referral
  app.post("/api/referrals/:id/conversations", requireAuth, async (req, res) => {
    try {
      const referralId = parseInt(req.params.id);
      const validatedData = createReferralConversationSchema.parse(req.body);
      
      const referral = await storage.getReferralById(referralId);
      
      if (!referral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Check if user has access to this referral
      const canAccess = req.user!.role === "admin" || 
                       req.user!.role === "analista" ||
                       referral.userId === req.user!.id ||
                       (req.user!.role === "promotor" && referral.promoterId === req.user!.id);
      
      if (!canAccess) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const conversation = await storage.createReferralConversation({
        ...validatedData,
        referralId,
        userId: req.user!.id
      });
      
      return res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      return res.status(500).json({ error: "Erro ao criar conversa" });
    }
  });

  // === COMPANY ROUTES ===
  
  // Get active companies (for user forms)
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companies = await storage.getActiveCompanies();
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

  // === ADMIN COMPANY ROUTES ===
  
  // Get all companies (admin only)
  app.get("/api/admin/companies", requireAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      return res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      return res.status(500).json({ error: "Erro ao buscar empresas" });
    }
  });

  // Create new company (admin only)
  app.post("/api/admin/companies", requireAdmin, async (req, res) => {
    try {
      const { name, isActive = true } = req.body;
      const company = await storage.createCompany(name, isActive);
      return res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      return res.status(500).json({ error: "Erro ao criar empresa" });
    }
  });

  // Update company (admin only)
  app.put("/api/admin/companies/:id", requireAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { name, isActive } = req.body;
      const company = await storage.updateCompany(companyId, { name, isActive });
      return res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      return res.status(500).json({ error: "Erro ao atualizar empresa" });
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
      
      // Check for pending or approved withdrawals with the same amount
      const existingWithdrawals = await storage.getWithdrawalRequestsByUserId(req.user!.id);
      const pendingWithdrawals = existingWithdrawals.filter(w => 
        (w.status === 'pending' || w.status === 'approved') && 
        parseFloat(w.amount) === validatedData.amount
      );
      
      if (pendingWithdrawals.length > 0) {
        return res.status(400).json({ 
          error: "Você já possui uma solicitação de saque com esse valor em andamento",
          details: "Você pode solicitar saques com valores diferentes"
        });
      }
      
      if (parseFloat(user.balance) < validatedData.amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      // 4. Validação para permitir sacar qualquer valor disponível
      const MIN_WITHDRAWAL_AMOUNT = 0.01;
      if (validatedData.amount < MIN_WITHDRAWAL_AMOUNT) {
        return res.status(400).json({ 
          error: "Valor inválido",
          details: `Valor mínimo: R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}` 
        });
      }
      
      // Permitir que o usuário use qualquer chave PIX válida
      // Removida validação restritiva que forçava usar apenas a chave cadastrada no perfil
      
      const withdrawal = await storage.createWithdrawalRequest({
        ...validatedData,
        userId: req.user!.id,
        requestType: user.role === 'promotor' ? 'promotor' : 'indicador'
      });
      
      // Descontar imediatamente o valor do saldo do usuário
      await storage.updateUserBalance(req.user!.id, -validatedData.amount);
      
      // Send SMS notification to admins about new withdrawal request
      try {
        const { sendAdminWithdrawalNotification } = await import('./sms-service');
        const admins = await storage.getUsersByRole('admin');
        
        // Send SMS to all admins with phone numbers
        for (const admin of admins) {
          if (admin.phone) {
            await sendAdminWithdrawalNotification(
              admin.phone,
              user.fullName,
              user.cpf,
              validatedData.amount
            );
            console.log(`SMS notification sent to admin ${admin.fullName} for new withdrawal request`);
          }
        }
      } catch (smsError) {
        console.log('Admin SMS notification failed (non-critical):', smsError);
        // Don't fail the withdrawal creation if SMS fails
      }
      
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
      const tickets = await storage.getSupportTicketById(req.user!.id);
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
      
      const ticket = await storage.createSupportTicket(
        req.user!.id,
        validatedData
      );
      
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
        isAdminResponse: req.user!.role === 'admin'
      });
      
      return res.status(201).json(response);
    } catch (error) {
      console.error("Error creating ticket response:", error);
      return res.status(500).json({ error: "Erro ao criar resposta" });
    }
  });

  // === PROMOTER ROUTES ===
  
  // Create indicador (only promoters)
  app.post("/api/users/indicador", requirePromoter, async (req, res) => {
    try {
      const validatedData = createIndicadorSchema.parse(req.body);
      
      // Hash the password before saving
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Get promoter info to check if they have a supervisor
      const promoter = await storage.getUserById(req.user!.id);
      
      // Add promoter relationship
      const userData = {
        ...validatedData,
        password: hashedPassword,
        promoterId: req.user!.id,
        createdBy: req.user!.id,
        analystId: undefined, // Explicitly set to undefined
        // Set the promoter as supervisor of the indicador
        supervisorId: req.user!.id,
        role: "indicador" as const
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating indicador:", error);
      return res.status(500).json({ error: "Erro ao criar indicador" });
    }
  });

  // Get indicadores under this promoter
  app.get("/api/users/indicadores", requirePromoter, async (req, res) => {
    try {
      const indicadores = await storage.getIndicadoresByPromoter(req.user!.id);
      return res.json(indicadores.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching indicadores:", error);
      return res.status(500).json({ error: "Erro ao buscar indicadores" });
    }
  });
  
  // Get all referrals from promoter's team
  app.get("/api/promoter/team-referrals", requirePromoter, async (req, res) => {
    try {
      const indicadores = await storage.getIndicadoresByPromoter(req.user!.id);
      const indicadorIds = indicadores.map(i => i.id);
      
      if (indicadorIds.length === 0) {
        return res.json([]);
      }
      
      const teamReferrals = await storage.getReferralsByUsers(indicadorIds);
      return res.json(teamReferrals);
    } catch (error) {
      console.error("Error fetching team referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações da equipe" });
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

  // Get all referrals for analysts
  app.get("/api/analyst/referrals", requireAnalyst, async (req, res) => {
    try {
      // Check if analyst has view_referrals permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("view_referrals")) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar indicações" });
      }
      
      // If analyst is level 3, only show referrals from supervised users
      let allReferrals;
      if (user?.analystLevel === 3) {
        allReferrals = await storage.getReferralsBySupervisor(req.user!.id);
      } else {
        allReferrals = await storage.getAllReferrals();
      }
      
      return res.json(allReferrals);
    } catch (error) {
      console.error("Error fetching all referrals for analyst:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Get stats for analysts
  app.get("/api/analyst/stats", requireAnalyst, async (req, res) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      
      let users, referrals;
      
      // If analyst is level 3, only show stats from supervised users
      if (user?.analystLevel === 3) {
        users = await storage.getAllUsersBySupervisor(req.user!.id);
        referrals = await storage.getReferralsBySupervisor(req.user!.id);
      } else {
        users = await storage.getAllUsers();
        referrals = await storage.getAllReferrals();
      }
      
      const totalIndicators = users.filter(u => u.role === "indicador").length;
      const totalPromoters = users.filter(u => u.role === "promotor").length;
      const totalReferrals = referrals.length;
      const pendingReferrals = referrals.filter(r => r.status === "pending").length;
      const convertedReferrals = referrals.filter(r => r.status === "converted" || r.status === "validated").length;
      
      return res.json({
        totalIndicators,
        totalPromoters,
        totalReferrals,
        pendingReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? (convertedReferrals / totalReferrals * 100).toFixed(1) : "0"
      });
    } catch (error) {
      console.error("Error fetching analyst stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Get users for analysts with view_users permission
  app.get("/api/analyst/users", requireAnalyst, async (req, res) => {
    try {
      // Check if analyst has view_users permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("view_users")) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar usuários" });
      }
      
      // If analyst is level 3, only show users under supervision
      let allUsers;
      if (user?.analystLevel === 3) {
        allUsers = await storage.getAllUsersBySupervisor(req.user!.id);
      } else {
        allUsers = await storage.getAllUsers();
      }
      
      // Remove passwords from the response
      const usersWithoutPasswords = allUsers.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });
      
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users for analyst:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Analytics routes for analysts with view_reports permission
  app.get("/api/analyst/analytics/users", requireAnalyst, async (req, res) => {
    try {
      // Check if analyst has view_reports permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("view_reports")) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar relatórios" });
      }
      
      // If analyst is level 3, only show users under supervision
      let allUsers;
      if (user?.analystLevel === 3) {
        allUsers = await storage.getAllUsersBySupervisor(req.user!.id);
      } else {
        allUsers = await storage.getAllUsers();
      }
      
      return res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users for analytics:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.get("/api/analyst/analytics/referrals", requireAnalyst, async (req, res) => {
    try {
      // Check if analyst has view_reports permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("view_reports")) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar relatórios" });
      }
      
      // If analyst is level 3, only show referrals from supervised users
      let allReferrals;
      if (user?.analystLevel === 3) {
        allReferrals = await storage.getReferralsBySupervisor(req.user!.id);
      } else {
        allReferrals = await storage.getAllReferrals();
      }
      
      return res.json(allReferrals);
    } catch (error) {
      console.error("Error fetching referrals for analytics:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  app.get("/api/analyst/analytics/audit-log", requireAnalyst, async (req, res) => {
    try {
      // Check if analyst has view_reports permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("view_reports")) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar relatórios" });
      }
      
      const auditLog = await storage.getRecentAuditLog();
      return res.json(auditLog);
    } catch (error) {
      console.error("Error fetching audit log for analytics:", error);
      return res.status(500).json({ error: "Erro ao buscar log de auditoria" });
    }
  });

  // Get basic stats (accessible by admin and analyst)
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      // Only admin and analyst can access
      if (req.user!.role !== "admin" && req.user!.role !== "analista") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const users = await storage.getAllUsers();
      const referrals = await storage.getAllReferrals();
      const withdrawals = await storage.getAllWithdrawalRequests();
      
      const totalIndicadores = users.filter(u => u.role === "indicador").length;
      const totalReferrals = referrals.length;
      const pendingReferrals = referrals.filter(r => r.status === "pending").length;
      const convertedReferrals = referrals.filter(r => r.status === "converted" || r.status === "validated").length;
      
      return res.json({
        totalIndicadores,
        totalReferrals,
        pendingReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? (convertedReferrals / totalReferrals * 100).toFixed(1) : "0"
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Update referral status
  app.patch("/api/referrals/:id/status", requireAdmin, async (req, res) => {
    try {
      console.log(`[/api/referrals/:id/status] Iniciando atualização - ID: ${req.params.id}, Body:`, req.body);
      
      const { id } = req.params;
      
      // Validate request body
      let validatedData;
      try {
        validatedData = updateReferralStatusSchema.parse(req.body);
        console.log(`[/api/referrals/:id/status] Dados validados:`, validatedData);
      } catch (validationError) {
        console.error(`[/api/referrals/:id/status] Erro de validação:`, validationError);
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: validationError instanceof Error ? validationError.message : "Erro de validação" 
        });
      }
      
      // Get referral and user info before update for SMS notification
      const referral = await storage.getReferralById(parseInt(id));
      if (!referral) {
        console.error(`[/api/referrals/:id/status] Indicação não encontrada: ${id}`);
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      console.log(`[/api/referrals/:id/status] Indicação atual:`, {
        id: referral.id,
        status: referral.status,
        commissionIndicator: referral.commissionIndicator,
        commissionPromoter: referral.commissionPromoter
      });
      
      const user = await storage.getUserById(referral.userId);
      
      let updatedReferral;
      try {
        updatedReferral = await storage.updateReferralStatus(
          parseInt(id),
          validatedData.status,
          validatedData.notes,
          req.user!.id
        );
      } catch (updateError) {
        console.error(`[/api/referrals/:id/status] Erro no updateReferralStatus:`, updateError);
        throw updateError;
      }

      // Send SMS notification if configured and user has phone
      if (user?.phone && validatedData.status !== referral?.status) {
        try {
          const { sendStatusUpdateNotification } = await import('./sms-service');
          await sendStatusUpdateNotification(
            user.phone,
            user.fullName,
            parseInt(id),
            validatedData.status
          );
          console.log(`SMS notification sent to ${user.phone} for referral status update`);
        } catch (smsError) {
          console.log('SMS notification failed (non-critical):', smsError);
          // Don't fail the update if SMS fails
        }
      }
      
      console.log(`[/api/referrals/:id/status] Indicação atualizada com sucesso:`, {
        id: updatedReferral.id,
        newStatus: updatedReferral.status,
        newCommissionIndicator: updatedReferral.commissionIndicator,
        newCommissionPromoter: updatedReferral.commissionPromoter
      });
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("[/api/referrals/:id/status] Erro ao atualizar status:", error);
      console.error("[/api/referrals/:id/status] Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      
      // Return more specific error messages
      if (error instanceof Error) {
        if (error.message === "Referral not found") {
          return res.status(404).json({ error: "Indicação não encontrada" });
        }
        return res.status(500).json({ 
          error: "Erro ao atualizar indicação",
          details: error.message
        });
      }
      
      return res.status(500).json({ error: "Erro ao atualizar indicação" });
    }
  });

  // Delete referral (admin only)
  app.delete("/api/referrals/:id", requireAdmin, async (req, res) => {
    try {
      const referralId = parseInt(req.params.id);
      
      // Check if referral exists
      const referral = await storage.getReferralById(referralId);
      if (!referral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Log the deletion
      await storage.logUserAction({
        userId: req.user!.id,
        action: "delete_referral",
        entityType: "referral",
        entityId: referralId,
        oldValues: referral,
        details: `Indicação ${referralId} deletada`
      });
      
      await storage.deleteReferral(referralId);
      
      return res.json({ message: "Indicação deletada com sucesso" });
    } catch (error) {
      console.error("Error deleting referral:", error);
      return res.status(500).json({ error: "Erro ao deletar indicação" });
    }
  });

  // Update referral data (admin only)
  // This route was moved to line 1219 to allow both admin and analysts to edit referrals

  // Get all indicadores for reassignment dropdown
  app.get("/api/admin/indicadores", requireAuth, async (req, res) => {
    try {
      // Allow admin and analyst to get indicadores list
      if (req.user!.role !== "admin" && req.user!.role !== "analista") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const indicadores = await storage.getUsersByRole("indicador");
      return res.json(indicadores.map(u => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username
      })));
    } catch (error) {
      console.error("Error fetching indicadores:", error);
      return res.status(500).json({ error: "Erro ao buscar indicadores" });
    }
  });

  // Export referrals to Excel
  app.get("/api/admin/export/referrals", requireAdmin, async (req, res) => {
    try {
      const XLSX = await import('xlsx');
      
      // Get all referrals with related data
      const referrals = await storage.getAllReferrals();
      const users = await storage.getAllUsers();
      const companies = await storage.getAllCompanies();
      
      // Map user and company data for quick lookup
      const userMap = new Map(users.map(u => [u.id, u]));
      const companyMap = new Map(companies.map(c => [c.id, c]));
      
      // Format data for Excel
      const excelData = referrals.map(r => {
        const user = userMap.get(r.userId);
        const company = companyMap.get(r.companyId);
        
        return {
          'ID': r.id,
          'Cliente': r.fullName,
          'Telefone': r.phone,
          'Placa': r.licensePlate,
          'Indicador': user ? user.fullName : 'N/A',
          'Empresa': company ? company.name : 'N/A',
          'Status': getStatusLabel(r.status),
          'Comissão Indicador (R$)': parseFloat(r.commissionIndicator || '0').toFixed(2),
          'Comissão Promotor (R$)': parseFloat(r.commissionPromoter || '0').toFixed(2),
          'Data Criação': new Date(r.createdAt).toLocaleDateString('pt-BR'),
          'Possui Seguro': r.hasInsurance ? 'Sim' : 'Não',
          'Marca Veículo': r.vehicleBrand || 'N/A',
          'Modelo Veículo': r.vehicleModel || 'N/A',
          'Ano Veículo': r.vehicleYear || 'N/A',
          'Observações': r.notes || ''
        };
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const colWidths = [
        { wch: 5 },   // ID
        { wch: 25 },  // Cliente
        { wch: 15 },  // Telefone
        { wch: 10 },  // Placa
        { wch: 25 },  // Indicador
        { wch: 30 },  // Empresa
        { wch: 15 },  // Status
        { wch: 20 },  // Comissão Indicador
        { wch: 20 },  // Comissão Promotor
        { wch: 15 },  // Data Criação
        { wch: 15 },  // Possui Seguro
        { wch: 15 },  // Marca
        { wch: 15 },  // Modelo
        { wch: 10 },  // Ano
        { wch: 40 }   // Observações
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Indicações');
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for download
      const filename = `indicacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length.toString());
      
      return res.send(buffer);
      
      function getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
          'pending': 'Pendente',
          'analyzing': 'Em Análise',
          'validated': 'Validado',
          'converted': 'Convertido',
          'rejected': 'Rejeitado',
          'paid': 'Pago',
          'false': 'Falso',
          'not_validated': 'Não validado',
          'not_converted': 'Não convertido'
        };
        return labels[status] || status;
      }
    } catch (error) {
      console.error("Error exporting referrals:", error);
      return res.status(500).json({ error: "Erro ao exportar indicações" });
    }
  });

  // Validate referral (for analysts and admins)
  app.patch("/api/referrals/:id/validate", requireAnalyst, async (req, res) => {
    try {
      const referralId = parseInt(req.params.id);
      const validatedData = validateReferralSchema.parse(req.body);
      
      const updatedReferral = await storage.validateReferral(
        referralId,
        validatedData,
        req.user!.id
      );
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error validating referral:", error);
      return res.status(500).json({ error: "Erro ao validar indicação" });
    }
  });

  // Edit referral (for analysts and admins)
  app.patch("/api/referrals/:id", requireAuth, async (req, res) => {
    try {
      // Check if user is admin or analyst - all analysts can edit referrals
      if (req.user!.role !== "admin" && req.user!.role !== "analista") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const referralId = parseInt(req.params.id);
      const { fullName, phone, licensePlate, companyId, userId, commissionIndicator, commissionPromoter, status, notes } = req.body;
      
      console.log("[PATCH /api/referrals/:id] Dados recebidos:", req.body);
      
      // Check if referral exists
      const existingReferral = await storage.getReferralById(referralId);
      if (!existingReferral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Prepare update data
      const updateData: any = {};
      
      // Only include fields that were sent in the request
      if (fullName !== undefined) updateData.fullName = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (licensePlate !== undefined) updateData.licensePlate = licensePlate;
      if (companyId !== undefined) updateData.companyId = parseInt(companyId);
      if (userId !== undefined) updateData.userId = parseInt(userId);
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (commissionIndicator !== undefined) updateData.commissionIndicator = commissionIndicator;
      if (commissionPromoter !== undefined) updateData.commissionPromoter = commissionPromoter;
      
      updateData.updatedAt = new Date();
      
      console.log("[PATCH /api/referrals/:id] updateData preparado:", updateData);
      
      // Check for duplicates if phone or licensePlate changed
      if ((phone && phone !== existingReferral.phone) || (licensePlate && licensePlate !== existingReferral.licensePlate)) {
        const duplicates = await storage.checkDuplicateReferral(phone || existingReferral.phone, licensePlate || existingReferral.licensePlate);
        const filteredDuplicates = duplicates.filter(d => d.id !== referralId);
        
        if (filteredDuplicates.length > 0) {
          return res.status(400).json({ 
            error: "Duplicata encontrada",
            details: "Já existe uma indicação com este telefone ou placa"
          });
        }
      }
      
      // Update the referral
      const updatedReferral = await storage.updateReferral(referralId, updateData, req.user!.id);
      
      // Log the update
      await storage.logUserAction({
        userId: req.user!.id,
        action: "update_referral",
        entityType: "referral",
        entityId: referralId,
        oldValues: existingReferral,
        newValues: updatedReferral,
        details: `Dados da indicação ${referralId} atualizados por ${req.user!.role}`
      });
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral:", error);
      return res.status(500).json({ error: "Erro ao editar indicação" });
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
      
      // Get withdrawal and user info before update for SMS notification
      const withdrawal = await storage.getWithdrawalRequestById(parseInt(id));
      const user = withdrawal ? await storage.getUserById(withdrawal.userId) : null;
      
      const updated = await storage.updateWithdrawalStatus(
        parseInt(id),
        status,
        req.user!.id,
        notes
      );

      // Send SMS notification for withdrawal approval/rejection
      if (user?.phone && withdrawal && (status === 'approved' || status === 'rejected')) {
        try {
          const { sendWithdrawalNotification } = await import('./sms-service');
          await sendWithdrawalNotification(
            user.phone,
            user.fullName,
            parseFloat(withdrawal.amount.toString()),
            status as 'approved' | 'rejected'
          );
          console.log(`SMS notification sent to ${user.phone} for withdrawal ${status}`);
        } catch (smsError) {
          console.log('SMS notification failed (non-critical):', smsError);
          // Don't fail the update if SMS fails
        }
      }
      
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

  // Update analyst permissions
  app.patch("/api/admin/users/:id/permissions", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateAnalystPermissionsSchema.parse(req.body);
      
      const updatedUser = await storage.updateUserPermissions(
        parseInt(id),
        validatedData.permissions,
        validatedData.analystLevel
      );
      
      const { password, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user permissions:", error);
      return res.status(500).json({ error: "Erro ao atualizar permissões" });
    }
  });

  // Get all analysts for permission management
  app.get("/api/admin/analysts", requireAdmin, async (req, res) => {
    try {
      const analysts = await storage.getUsersByRole("analista");
      return res.json(analysts.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching analysts:", error);
      return res.status(500).json({ error: "Erro ao buscar analistas" });
    }
  });

  // Get all promoters
  app.get("/api/admin/promoters", requireAdmin, async (req, res) => {
    try {
      const promoters = await storage.getUsersByRole("promotor");
      return res.json(promoters.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error) {
      console.error("Error fetching promoters:", error);
      return res.status(500).json({ error: "Erro ao buscar promotores" });
    }
  });

  // Create new user (admin only)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Hash the password before saving
      const hashedPassword = await hashPassword(req.body.password);
      
      const userData = {
        ...req.body,
        password: hashedPassword,
        createdBy: req.user!.id
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      // Send welcome SMS to new user if they have a phone
      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          await sendWelcomeSMS(newUser.phone, newUser.fullName);
          console.log(`Welcome SMS sent to new user: ${newUser.fullName} (${newUser.phone})`);
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
          // Don't fail user creation if SMS fails
        }
      }
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  // Create new indicador (analysts with permission can create)
  app.post("/api/analyst/indicadores", requireAnalystPermission("create_indicadores"), async (req, res) => {
    try {
      // Hash the password before saving
      const hashedPassword = await hashPassword(req.body.password);
      
      // Get analyst info to check if level 3
      const analyst = await storage.getUserById(req.user!.id);
      
      // Force role to be indicador and set analyst as creator
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: "indicador",
        createdBy: req.user!.id,
        // If analyst is level 3, set them as supervisor
        supervisorId: (analyst?.role === "analista" && analyst?.analystLevel === 3) ? req.user!.id : undefined
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      // Send welcome SMS to new user if they have a phone
      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          await sendWelcomeSMS(newUser.phone, newUser.fullName);
          console.log(`Welcome SMS sent to new indicador: ${newUser.fullName} (${newUser.phone})`);
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
        }
      }
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating indicador:", error);
      return res.status(500).json({ error: "Erro ao criar indicador" });
    }
  });

  // Create new promotor (analysts with permission can create)
  app.post("/api/analyst/promotores", requireAnalystPermission("create_promotores"), async (req, res) => {
    try {
      // Hash the password before saving
      const hashedPassword = await hashPassword(req.body.password);
      
      // Get analyst info to check if level 3
      const analyst = await storage.getUserById(req.user!.id);
      
      // Force role to be promotor and set analyst as creator
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: "promotor",
        createdBy: req.user!.id,
        // If analyst is level 3, set them as supervisor
        supervisorId: (analyst?.role === "analista" && analyst?.analystLevel === 3) ? req.user!.id : undefined
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      // Send welcome SMS to new user if they have a phone
      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          await sendWelcomeSMS(newUser.phone, newUser.fullName);
          console.log(`Welcome SMS sent to new promotor: ${newUser.fullName} (${newUser.phone})`);
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
        }
      }
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating promotor:", error);
      return res.status(500).json({ error: "Erro ao criar promotor" });
    }
  });

  // Create new indicador (promotors can create)
  app.post("/api/promoter/indicators", requireAuth, async (req, res) => {
    try {
      // Check if user is a promotor
      if (req.user!.role !== "promotor") {
        return res.status(403).json({ error: "Apenas promotores podem cadastrar indicadores" });
      }

      // Hash the password before saving
      const hashedPassword = await hashPassword(req.body.password);

      // Force role to be indicador and set promotor as creator
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: "indicador",
        createdBy: req.user!.id,
        promoterId: req.user!.id // Automatically assign to the creating promotor
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      // Send welcome SMS to new user if they have a phone
      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          await sendWelcomeSMS(newUser.phone, newUser.fullName);
          console.log(`Welcome SMS sent to new indicador: ${newUser.fullName} (${newUser.phone})`);
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
        }
      }
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating indicador:", error);
      return res.status(500).json({ error: "Erro ao criar indicador" });
    }
  });

  // Update user profile (admin only)
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = parseInt(id);
      
      // Check if promoterId is being updated
      if (updates.promoterId !== undefined) {
        const currentUser = await storage.getUserById(userId);
        
        // If promoterId is changing, update all referrals to the new promoter
        if (currentUser && currentUser.promoterId !== updates.promoterId) {
          await storage.transferReferralsToPromoter(userId, updates.promoterId);
        }
      }
      
      const updatedUser = await storage.updateUserProfile(userId, updates);
      const { password, ...userWithoutPassword } = updatedUser;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });

  // === AUDIT TRAIL ROUTES ===
  
  // Get audit log
  app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
    try {
      const { userId, entityType, fromDate, toDate } = req.query;
      
      const filters: any = {};
      if (userId) filters.userId = parseInt(userId as string);
      if (entityType) filters.entityType = entityType as string;
      if (fromDate) filters.fromDate = new Date(fromDate as string);
      if (toDate) filters.toDate = new Date(toDate as string);
      
      const auditLogs = await storage.getAuditLog(filters);
      return res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      return res.status(500).json({ error: "Erro ao buscar log de auditoria" });
    }
  });

  // === TEAM MANAGEMENT ROUTES ===
  
  // Get team referrals (for promoter)
  app.get("/api/team/referrals", requirePromoter, async (req, res) => {
    try {
      const teamReferrals = await storage.getReferralsByTeam(req.user!.id);
      return res.json(teamReferrals);
    } catch (error) {
      console.error("Error fetching team referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações da equipe" });
    }
  });
  
  // Get user team statistics
  app.get("/api/team/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserTeamStats(req.user!.id);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching team stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas da equipe" });
    }
  });

  // === ENHANCED WITHDRAWAL ROUTES ===
  
  // Validate CPF for withdrawal
  app.post("/api/withdrawals/validate-cpf", requireAuth, async (req, res) => {
    try {
      const { cpf } = req.body;
      const isValid = await storage.validateCpfForWithdrawal(req.user!.id, cpf);
      return res.json({ valid: isValid });
    } catch (error) {
      console.error("Error validating CPF:", error);
      return res.status(500).json({ error: "Erro ao validar CPF" });
    }
  });

  // Toggle user active status
  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const updatedUser = await storage.updateUserStatus(parseInt(id), isActive);
      const { password, ...userWithoutPassword } = updatedUser;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status do usuário" });
    }
  });

  // Reset user password
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { customPassword } = req.body;
      
      const newPassword = await storage.resetUserPassword(parseInt(id), customPassword);
      
      return res.json({ 
        message: "Senha redefinida com sucesso",
        newPassword: newPassword,
        success: true
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ error: "Erro ao redefinir senha" });
    }
  });

  // Delete user with developer master password
  app.delete("/api/admin/users/:id/delete", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { masterPassword } = req.body;
      
      console.log('Delete user request:', { id, masterPassword: masterPassword ? '***' : 'undefined', body: req.body });
      
      // Validate master password
      const DEVELOPER_MASTER_PASSWORD = process.env.DEVELOPER_MASTER_PASSWORD;
      if (!masterPassword) {
        return res.status(400).json({ error: "Senha mestre é obrigatória" });
      }
      
      if (!DEVELOPER_MASTER_PASSWORD) {
        console.error("DEVELOPER_MASTER_PASSWORD environment variable not set");
        return res.status(500).json({ error: "Configuração do servidor incompleta" });
      }
      
      if (masterPassword !== DEVELOPER_MASTER_PASSWORD) {
        return res.status(403).json({ error: "Senha mestre incorreta" });
      }
      
      // Check if user exists
      const userToDelete = await storage.getUserById(parseInt(id));
      if (!userToDelete) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Admin users can now be deleted with master password
      
      // Delete the user
      await storage.deleteUser(parseInt(id));
      
      // Log audit trail
      try {
        await storage.logUserAction({
          userId: req.user!.id,
          action: 'delete',
          entityType: 'user',
          entityId: parseInt(id),
          oldValues: userToDelete,
          details: `Usuário ${userToDelete.fullName} (${userToDelete.username}) foi deletado permanentemente`
        });
      } catch (error) {
        console.warn('Failed to log user deletion:', error);
      }
      
      return res.json({ 
        message: "Usuário deletado com sucesso",
        deletedUser: userToDelete.fullName
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  });

  // === SUPPORT TICKET ROUTES ===

  // Create new support ticket
  app.post("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const { createSupportTicketSchema } = await import("@shared/schema.ts");
      const validatedData = createSupportTicketSchema.parse(req.body);
      
      const ticket = await storage.createSupportTicket(req.user!.id, validatedData);
      return res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating support ticket:", error);
      return res.status(500).json({ error: "Erro ao criar ticket de suporte" });
    }
  });

  // Get user's own tickets
  app.get("/api/support/my-tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getUserSupportTickets(req.user!.id);
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      return res.status(500).json({ error: "Erro ao buscar tickets" });
    }
  });

  // Upload file for support ticket
  app.post("/api/support/upload", requireAuth, async (req, res) => {
    try {
      // In a real application, you would handle file upload to a service like AWS S3
      // For now, we'll simulate file upload and return a mock URL
      const { file } = req.body;
      const mockUrl = `/uploads/support/${Date.now()}-${Math.random()}.jpg`;
      return res.json({ url: mockUrl });
    } catch (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({ error: "Erro ao fazer upload do arquivo" });
    }
  });

  // Admin: Get all support tickets
  app.get("/api/admin/support-tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      return res.status(500).json({ error: "Erro ao buscar tickets de suporte" });
    }
  });

  // Admin: Update ticket status
  app.patch("/api/admin/support-tickets/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { updateTicketStatusSchema } = await import("@shared/schema.ts");
      const { status } = updateTicketStatusSchema.parse(req.body);
      
      const updated = await storage.updateTicketStatus(parseInt(id), status);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status do ticket" });
    }
  });

  // Admin: Add response to ticket
  app.post("/api/admin/support-tickets/:id/responses", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { createTicketResponseSchema } = await import("@shared/schema.ts");
      const validatedData = createTicketResponseSchema.parse(req.body);
      
      const response = await storage.createTicketResponse({
        ticketId: parseInt(id),
        userId: req.user!.id,
        message: validatedData.message,
        isAdminResponse: true
      });
      return res.status(201).json(response);
    } catch (error) {
      console.error("Error adding ticket response:", error);
      return res.status(500).json({ error: "Erro ao adicionar resposta ao ticket" });
    }
  });

  // === SALES CRM ROUTES (VENDEDOR) ===

  // Get sales leads for vendedor
  app.get("/api/sales/leads", requireVendedor, async (req, res) => {
    try {
      const leads = await storage.getSalesLeadsByVendedor(req.user!.id);
      return res.json(leads);
    } catch (error) {
      console.error("Error fetching sales leads:", error);
      return res.status(500).json({ error: "Erro ao buscar leads" });
    }
  });

  // Create new sales lead
  app.post("/api/sales/leads", requireVendedor, async (req, res) => {
    try {
      const { createSalesLeadSchema } = await import("@shared/schema.ts");
      const validatedData = createSalesLeadSchema.parse(req.body);
      
      const lead = await storage.createSalesLead(validatedData, req.user!.id);
      return res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating sales lead:", error);
      return res.status(500).json({ error: "Erro ao criar lead" });
    }
  });

  // Get specific sales lead with timeline
  app.get("/api/sales/leads/:id", requireVendedor, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.getSalesLeadById(parseInt(id), req.user!.id);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead não encontrado" });
      }
      
      return res.json(lead);
    } catch (error) {
      console.error("Error fetching sales lead:", error);
      return res.status(500).json({ error: "Erro ao buscar lead" });
    }
  });

  // Update sales lead
  app.patch("/api/sales/leads/:id", requireVendedor, async (req, res) => {
    try {
      const { id } = req.params;
      const { updateSalesLeadSchema } = await import("@shared/schema.ts");
      const validatedData = updateSalesLeadSchema.parse(req.body);
      
      const lead = await storage.updateSalesLead(parseInt(id), req.user!.id, validatedData);
      return res.json(lead);
    } catch (error) {
      console.error("Error updating sales lead:", error);
      return res.status(500).json({ error: "Erro ao atualizar lead" });
    }
  });

  // Add activity to sales lead
  app.post("/api/sales/leads/:id/activities", requireVendedor, async (req, res) => {
    try {
      const { id } = req.params;
      const { createSalesActivitySchema } = await import("@shared/schema.ts");
      const validatedData = createSalesActivitySchema.parse(req.body);
      
      const activity = await storage.createSalesActivity({
        ...validatedData,
        leadId: parseInt(id),
        vendedorId: req.user!.id
      });
      
      return res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating sales activity:", error);
      return res.status(500).json({ error: "Erro ao criar atividade" });
    }
  });

  // Get sales statistics for vendedor
  app.get("/api/sales/stats", requireVendedor, async (req, res) => {
    try {
      const stats = await storage.getSalesStats(req.user!.id);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching sales stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Convert referral to lead
  app.post("/api/sales/convert-referral/:referralId", requireVendedor, async (req, res) => {
    try {
      const { referralId } = req.params;
      const lead = await storage.convertReferralToLead(parseInt(referralId), req.user!.id);
      return res.status(201).json(lead);
    } catch (error) {
      console.error("Error converting referral to lead:", error);
      return res.status(500).json({ error: "Erro ao converter indicação em lead" });
    }
  });

  // Get referrals available for conversion
  app.get("/api/sales/available-referrals", requireVendedor, async (req, res) => {
    try {
      const referrals = await storage.getReferralsByStatus("validated");
      return res.json(referrals);
    } catch (error) {
      console.error("Error fetching available referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações disponíveis" });
    }
  });

  // Assign indicator to promoter (admin only)
  app.patch("/api/admin/users/:id/assign-promoter", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { promoterId } = req.body;
      
      // Update user with new promoter assignment
      const updatedUser = await storage.assignIndicatorToPromoter(parseInt(id), promoterId);
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Log audit trail
      try {
        const action = promoterId ? "assign_promoter" : "unassign_promoter";
        const details = promoterId 
          ? `Indicador ${updatedUser.fullName} atribuído ao promotor ID: ${promoterId}`
          : `Indicador ${updatedUser.fullName} removido de promotor`;
          
        await storage.logUserAction({
          userId: req.user!.id,
          action,
          entityType: 'user',
          entityId: parseInt(id),
          details
        });
      } catch (error) {
        console.warn('Failed to log promoter assignment:', error);
      }
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error assigning promoter:", error);
      return res.status(500).json({ error: "Erro ao atribuir promotor" });
    }
  });

  // SMS Configuration and Testing Routes
  // Get SMS status and configuration
  app.get("/api/admin/sms/status", requireAdmin, async (req, res) => {
    const { isSMSConfigured, getSMSStatus } = await import('./sms-service');
    
    try {
      const status = getSMSStatus();
      return res.json({
        ...status,
        message: status.configured 
          ? "SMS está configurado e pronto para uso"
          : "SMS não está configurado - adicione as credenciais do Twilio"
      });
    } catch (error) {
      console.error("Error getting SMS status:", error);
      return res.status(500).json({ error: "Erro ao verificar status do SMS" });
    }
  });

  // Test SMS functionality
  app.post("/api/admin/sms/test", requireAdmin, async (req, res) => {
    const { testSMS } = await import('./sms-service');
    
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Número de telefone é obrigatório" });
      }

      const success = await testSMS(phoneNumber);
      
      if (success) {
        return res.json({ 
          success: true, 
          message: "SMS de teste enviado com sucesso!" 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: "Falha ao enviar SMS - verifique as configurações" 
        });
      }
    } catch (error) {
      console.error("Error testing SMS:", error);
      return res.status(500).json({ error: "Erro ao testar SMS" });
    }
  });

  // Send manual SMS notification
  app.post("/api/admin/sms/send", requireAdmin, async (req, res) => {
    const { sendSMS } = await import('./sms-service');
    
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Número e mensagem são obrigatórios" });
      }

      const success = await sendSMS(phoneNumber, message);
      
      if (success) {
        // Log the manual SMS sending
        await storage.logUserAction({
          userId: req.user!.id,
          action: 'send_manual_sms',
          entityType: 'sms',
          entityId: 0,
          details: `SMS manual enviado para ${phoneNumber}: ${message.substring(0, 50)}...`
        });

        return res.json({ 
          success: true, 
          message: "SMS enviado com sucesso!" 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: "Falha ao enviar SMS" 
        });
      }
    } catch (error) {
      console.error("Error sending manual SMS:", error);
      return res.status(500).json({ error: "Erro ao enviar SMS" });
    }
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}