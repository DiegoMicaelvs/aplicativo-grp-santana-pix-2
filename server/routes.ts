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
  createReferralLinkSchema,
  updateReferralLinkSchema,
  type AnalystPermission,
  type ManagerPermission
} from "@shared/schema";
import { 
  registerCrossAppValidationRoutes,
  validateUserDuplicates,
  validateReferralDuplicates 
} from "./crossAppValidation";
import { attachTenantMiddleware, getCurrentTenant } from "./tenancy";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Setup tenant middleware for multi-company support
  app.use(attachTenantMiddleware);
  
  // Register cross-app validation routes
  registerCrossAppValidationRoutes(app);

  // Helper function to get status label
  const getStatusLabel = (status: string): string => {
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
  };

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

  // Middleware to check metis_viewer role
  const requireMetisViewer = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || (req.user.role !== "metis_viewer" && req.user.role !== "admin")) {
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

  // Middleware to forbid specific roles from accessing endpoints
  const forbidRole = (role: string, message?: string) => {
    return (req: any, res: any, next: any) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      if (req.user.role === role) {
        return res.status(403).json({ 
          error: "Acesso negado",
          details: message || `Usuários do tipo '${role}' não podem acessar esta funcionalidade`
        });
      }
      next();
    };
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
      
      // Calculate total earnings based on paid withdrawals
      const withdrawalRequests = await storage.getWithdrawalRequestsByUserId(user.id);
      let realTotalEarnings = 0;
      
      // Sum only paid withdrawals
      for (const withdrawal of withdrawalRequests) {
        if (withdrawal.status === 'paid') {
          realTotalEarnings += parseFloat(withdrawal.amount || '0');
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

  // Get current tenant info (company identification)
  app.get("/api/tenant", async (req, res) => {
    try {
      const tenantConfig = getCurrentTenant(req);
      return res.json(tenantConfig);
    } catch (error) {
      console.error("Error fetching tenant config:", error);
      return res.status(500).json({ error: "Erro ao buscar configuração do tenant" });
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
  
  // Get user details by ID (for fetching supervisor info)
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user details:", error);
      return res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
    }
  });

  // Create a new referral
  app.post("/api/referrals", requireAuth, async (req, res) => {
    try {
      // Pre-normalize for backward compatibility: convert single licensePlate to licensePlates array
      let requestBody = { ...req.body };
      if (requestBody.licensePlate && !requestBody.licensePlates) {
        requestBody.licensePlates = [requestBody.licensePlate];
        delete requestBody.licensePlate;
      }
      
      const validatedData = createReferralSchema.parse(requestBody);
      
      // === SISTEMA DE SEGURANÇA PARA LEADS ===
      
      // 1. Verificar limite de 50 referrals por dia (não aplicar para indicador_nivel_1)
      if (req.user!.role !== "indicador_nivel_1") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayReferrals = await storage.getTodayReferralsByUserId(req.user!.id, today);
        
        if (todayReferrals.length >= 50) {
          return res.status(400).json({ 
            error: "Limite diário atingido",
            details: `Você já cadastrou ${todayReferrals.length} clientes hoje. Limite máximo: 50 por dia.`
          });
        }
      }
      
      // 2. Verificar duplicatas locais (placas APENAS - telefone pode repetir para múltiplas placas)
      // Get all plates to check - support both new licensePlates array and legacy single plate
      const platesToCheck = validatedData.licensePlates || [];
      let allDuplicates: any[] = [];
      
      // Check each plate for duplicates (NOT phone - phone can be same for multiple plates)
      for (const plate of platesToCheck) {
        if (plate) {
          const plateDuplicates = await storage.checkDuplicateReferralWithOwner(undefined, plate);
          // Add plate duplicates that aren't already in the list
          plateDuplicates.forEach(duplicate => {
            if (!allDuplicates.find(d => d.id === duplicate.id)) {
              allDuplicates.push(duplicate);
            }
          });
        }
      }
      
      if (allDuplicates.length > 0) {
        const duplicate = allDuplicates[0];
        const ownerFirstName = duplicate.createdByFirstName || 'Usuário';
        const ownerState = duplicate.createdByState || '';
        const ownerInfo = ownerState ? `${ownerFirstName} (${ownerState})` : ownerFirstName;
        
        // Find which specific plate is duplicated
        let duplicatedPlate = '';
        for (const plate of platesToCheck) {
          if (duplicate.licensePlate && duplicate.licensePlate.toLowerCase() === plate.toLowerCase()) {
            duplicatedPlate = plate;
            break;
          }
        }
        
        let errorMessage = `Placa ${duplicatedPlate} já cadastrada por ${ownerInfo}\n`;
        errorMessage += `Data do primeiro cadastro: ${new Date(duplicate.createdAt).toLocaleDateString('pt-BR')}`;
        
        return res.status(400).json({ 
          error: "Placa duplicada",
          details: errorMessage,
          duplicatedBy: ownerInfo,
          originalDate: duplicate.createdAt
        });
      }

      // 3. Verificar duplicatas em outros aplicativos (validação cruzada)
      // Check all plates for cross-app validation
      for (const plate of platesToCheck) {
        if (plate) {
          const crossAppValidation = await validateReferralDuplicates({
            phone: validatedData.phone,
            licensePlate: plate
          });
          
          if (crossAppValidation.isDuplicate) {
            const validationError = crossAppValidation.message || 
              `Esta indicação já foi cadastrada em outro aplicativo (placa: ${plate})`;
            
            return res.status(400).json({
              error: "Indicação duplicada em outro app",
              details: validationError,
              crossAppDuplicate: true,
              duplicatedPlate: plate
            });
          }
        }
      }
      
      // Apply tenant-based company enforcement
      let finalReferralData = { ...validatedData };
      
      // For non-admin users, enforce tenant company ID for security
      if (req.user!.role !== "admin") {
        const tenantConfig = getCurrentTenant(req);
        finalReferralData.companyId = tenantConfig.companyId;
        console.log(`[TENANT] Non-admin user ${req.user!.role} - enforcing companyId: ${tenantConfig.companyId} (${tenantConfig.companyName})`);
      } else {
        console.log(`[TENANT] Admin user - allowing selected companyId: ${finalReferralData.companyId}`);
      }
      
      // Create a separate referral for EACH license plate
      const licensePlates = finalReferralData.licensePlates || [];
      console.log(`[CREATE REFERRAL] Number of plates to create: ${licensePlates.length}`, licensePlates);
      const createdReferrals = [];
      
      for (const plate of licensePlates) {
        // Create a copy of referralData without licensePlates, then add single plate
        const { licensePlates: _, ...referralDataWithoutPlates } = finalReferralData;
        
        console.log(`[CREATE REFERRAL] Creating referral for plate: ${plate}`);
        const referralForPlate = await storage.createReferral({
          ...referralDataWithoutPlates,
          licensePlates: [plate], // Pass single plate in array for storage
          userId: req.user!.id,
          createdBy: req.user!.id
        });
        console.log(`[CREATE REFERRAL] Created referral ID: ${referralForPlate.id} for plate: ${plate}`);
        createdReferrals.push(referralForPlate);
      }
      
      console.log(`[CREATE REFERRAL] Total referrals created: ${createdReferrals.length}`);

      // Send SMS notification to user about new referral(s)
      const user = await storage.getUserById(req.user!.id);
      if (user?.phone && createdReferrals.length > 0) {
        try {
          const { sendReferralNotification } = await import('./sms-service');
          // Send notification for first referral (or we could mention "X placas cadastradas")
          await sendReferralNotification(
            user.phone,
            user.fullName,
            createdReferrals[0].id
          );
          console.log(`SMS notification sent to ${user.phone} for ${createdReferrals.length} new referral(s)`);
        } catch (smsError) {
          console.log('SMS notification failed (non-critical):', smsError);
          // Don't fail the referral creation if SMS fails
        }
      }
      
      // Return all created referrals (or just the first one for backward compatibility)
      return res.status(201).json({
        success: true,
        count: createdReferrals.length,
        referrals: createdReferrals,
        // For backward compatibility, also return first referral at root level
        ...createdReferrals[0]
      });
    } catch (error) {
      console.error("Error creating referral:", error);
      return res.status(500).json({ error: "Erro ao criar indicação" });
    }
  });

  // Check for duplicate referrals
  app.post("/api/referrals/check-duplicate", requireAuth, async (req, res) => {
    try {
      const { phone, licensePlate, licensePlates } = req.body;
      
      // Support both single plate (legacy) and multiple plates (new)
      const platesToCheck = licensePlates || (licensePlate ? [licensePlate] : []);
      
      let allDuplicates: any[] = [];
      
      // Check phone duplicates if provided
      if (phone) {
        const phoneDuplicates = await storage.checkDuplicateReferralWithOwner(phone);
        allDuplicates.push(...phoneDuplicates);
      }
      
      // Check each plate for duplicates
      for (const plate of platesToCheck) {
        if (plate) {
          const plateDuplicates = await storage.checkDuplicateReferralWithOwner(undefined, plate);
          // Add plate duplicates that aren't already in the list
          plateDuplicates.forEach(duplicate => {
            if (!allDuplicates.find(d => d.id === duplicate.id)) {
              allDuplicates.push(duplicate);
            }
          });
        }
      }
      
      return res.json({ 
        isDuplicate: allDuplicates.length > 0,
        duplicates: allDuplicates.map(duplicate => ({
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
      
      // For indicador_nivel_1 users, return unlimited stats
      if (req.user!.role === "indicador_nivel_1") {
        return res.json({
          count: todayReferrals.length,
          limit: null,
          remaining: null,
          isUnlimited: true
        });
      }
      
      // For all other users, return standard 50-limit stats
      return res.json({
        count: todayReferrals.length,
        limit: 50,
        remaining: Math.max(0, 50 - todayReferrals.length),
        isUnlimited: false
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

  // Update company cash balance (admin only)
  app.patch("/api/admin/companies/:id/cash-balance", requireAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { cashBalance } = req.body;
      
      if (isNaN(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "ID da empresa inválido" });
      }

      if (cashBalance === undefined || isNaN(parseFloat(cashBalance))) {
        return res.status(400).json({ error: "Valor de caixa inválido" });
      }

      // Get company to confirm it exists
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      // Update company cash balance in company_settings table
      const settings = await storage.updateCompanyCashBalance(companyId, cashBalance.toString(), req.user!.id);
      
      return res.json({ ...company, cashBalance: settings.cashBalance });
    } catch (error) {
      console.error("Error updating company cash balance:", error);
      return res.status(500).json({ error: "Erro ao atualizar caixa da empresa" });
    }
  });

  // Get company metrics (admin only)
  app.get("/api/admin/company-metrics/:companyId", requireAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const monthFilter = req.query.month as string;
      
      // Validate companyId parameter
      if (isNaN(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "ID da empresa inválido" });
      }
      
      // Get company info
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      // Get referrals for this specific company (efficient query)
      let companyReferrals = await storage.getReferralsByCompanyId(companyId);
      
      // Filter by month if specified
      if (monthFilter && monthFilter !== "all_time") {
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        companyReferrals = companyReferrals.filter((r: any) => {
          // For validated referrals, check validatedAt date
          if (r.status === 'validated' && r.validatedAt) {
            const validatedDate = new Date(r.validatedAt);
            return validatedDate >= startDate && validatedDate <= endDate;
          }
          
          // For converted/paid referrals, check updatedAt date (when status changed)
          if ((r.status === 'converted' || r.status === 'paid') && r.updatedAt) {
            const convertedDate = new Date(r.updatedAt);
            return convertedDate >= startDate && convertedDate <= endDate;
          }
          
          // For other statuses, check createdAt date
          const referralDate = new Date(r.createdAt);
          return referralDate >= startDate && referralDate <= endDate;
        });
      }
      
      // Calculate metrics
      const totalReferrals = companyReferrals.length;
      const convertedReferrals = companyReferrals.filter((r: any) => 
        r.status === 'converted' || r.status === 'paid'
      ).length;
      const pendingReferrals = companyReferrals.filter((r: any) => r.status === 'pending').length;
      const analyzingReferrals = companyReferrals.filter((r: any) => r.status === 'analyzing').length;
      const validatedReferrals = companyReferrals.filter((r: any) => r.status === 'validated').length;
      const rejectedReferrals = companyReferrals.filter((r: any) => 
        r.status === 'rejected' || r.status === 'false' || r.status === 'not_converted'
      ).length;

      const conversionRate = validatedReferrals > 0 ? (convertedReferrals / validatedReferrals) * 100 : 0;

      // Calculate commissions based on whether we're filtering by month or not
      let totalCommissionIndicators = 0;
      let totalCommissionPromoters = 0;
      
      if (monthFilter && monthFilter !== "all_time") {
        // Monthly view: calculate only commissions GENERATED in this specific month
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        // Get ALL referrals for the company (not just filtered ones)
        const allCompanyReferrals = await storage.getReferralsByCompanyId(companyId);
        
        for (const referral of allCompanyReferrals) {
          // Check if validated in this month
          if (referral.validatedAt) {
            const validatedDate = new Date(referral.validatedAt);
            if (validatedDate >= startDate && validatedDate <= endDate) {
              totalCommissionIndicators += 3; // Validation commission for indicator
              totalCommissionPromoters += 1; // Validation commission for promoter
            }
          }
          
          // Check if converted in this month
          if ((referral.status === 'converted' || referral.status === 'paid') && referral.updatedAt) {
            const convertedDate = new Date(referral.updatedAt);
            if (convertedDate >= startDate && convertedDate <= endDate) {
              totalCommissionIndicators += 50; // Conversion commission for indicator
              totalCommissionPromoters += 10; // Conversion commission for promoter
            }
          }
        }
      } else {
        // All-time view: use total accumulated commissions
        const paidReferrals = companyReferrals.filter((r: any) => 
          r.status === 'validated' || r.status === 'converted' || r.status === 'paid'
        );
        
        totalCommissionIndicators = paidReferrals.reduce((sum: number, r: any) => 
          sum + (parseFloat(r.commissionIndicator) || 0), 0
        );
        totalCommissionPromoters = paidReferrals.reduce((sum: number, r: any) => 
          sum + (parseFloat(r.commissionPromoter) || 0), 0
        );
      }
      
      const totalCommissions = totalCommissionIndicators + totalCommissionPromoters;

      // Get unique users involved with this company
      const indicatorsInvolved = new Set(companyReferrals.map((r: any) => r.userId));
      const promotersInvolved = new Set(companyReferrals.map((r: any) => r.promoterId).filter(Boolean));

      const totalIndicators = indicatorsInvolved.size;
      const totalPromoters = promotersInvolved.size;

      // Calculate active indicators (those who made referrals in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentReferrals = companyReferrals.filter((r: any) => 
        new Date(r.createdAt) >= thirtyDaysAgo
      ).length;
      
      const activeIndicators = new Set(
        companyReferrals
          .filter((r: any) => new Date(r.createdAt) >= thirtyDaysAgo)
          .map((r: any) => r.userId)
      ).size;

      const averageReferralsPerIndicator = totalIndicators > 0 ? totalReferrals / totalIndicators : 0;

      // For now, set paid values to 0 until we can fix the withdrawal data issue
      // TODO: Implement proper calculation once withdrawal table is fixed
      const totalPaidToIndicators = 0;
      const totalPaidToPromoters = 0;
      const totalPaidValues = 0;

      // Get cash balance from company settings
      const settings = await storage.getCompanySettings(companyId);

      const metrics = {
        companyId,
        companyName: company.name,
        cashBalance: parseFloat(settings.cashBalance || '0'),
        totalIndicators,
        totalPromoters,
        totalReferrals,
        convertedReferrals,
        conversionRate,
        averageReferralsPerIndicator,
        totalCommissionIndicators,
        totalCommissionPromoters,
        totalCommissions,
        activeIndicators,
        recentReferrals,
        pendingReferrals,
        analyzingReferrals,
        validatedReferrals,
        rejectedReferrals,
        totalPaidToIndicators,
        totalPaidToPromoters,
        totalPaidValues
      };

      return res.json(metrics);
    } catch (error) {
      console.error("Error fetching company metrics:", error);
      return res.status(500).json({ error: "Erro ao buscar métricas da empresa" });
    }
  });

  // Public company metrics (no authentication required)
  app.get("/api/public/company-metrics/:tokenOrId", async (req, res) => {
    try {
      const tokenOrId = req.params.tokenOrId;
      const monthFilter = req.query.month as string;
      
      // Try to get company by token first (new method), then by ID (backward compatibility)
      let company = null;
      let companyId = 0;
      
      // Check if it's a numeric ID (backward compatibility)
      const numericId = parseInt(tokenOrId);
      if (!isNaN(numericId) && numericId > 0) {
        company = await storage.getCompanyById(numericId);
        companyId = numericId;
      } else {
        // It's a token, search by token
        company = await storage.getCompanyByToken(tokenOrId);
        companyId = company?.id || 0;
      }
      
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      // Get referrals for this specific company (efficient query)
      let companyReferrals = await storage.getReferralsByCompanyId(companyId);
      
      // Filter by month if specified
      if (monthFilter && monthFilter !== "all_time") {
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        companyReferrals = companyReferrals.filter((r: any) => {
          // For validated referrals, check validatedAt date
          if (r.status === 'validated' && r.validatedAt) {
            const validatedDate = new Date(r.validatedAt);
            return validatedDate >= startDate && validatedDate <= endDate;
          }
          
          // For converted/paid referrals, check updatedAt date (when status changed)
          if ((r.status === 'converted' || r.status === 'paid') && r.updatedAt) {
            const convertedDate = new Date(r.updatedAt);
            return convertedDate >= startDate && convertedDate <= endDate;
          }
          
          // For other statuses, check createdAt date
          const referralDate = new Date(r.createdAt);
          return referralDate >= startDate && referralDate <= endDate;
        });
      }
      
      // Calculate metrics (same logic as admin endpoint)
      const totalReferrals = companyReferrals.length;
      const convertedReferrals = companyReferrals.filter((r: any) => 
        r.status === 'converted' || r.status === 'paid'
      ).length;
      const pendingReferrals = companyReferrals.filter((r: any) => r.status === 'pending').length;
      const analyzingReferrals = companyReferrals.filter((r: any) => r.status === 'analyzing').length;
      const validatedReferrals = companyReferrals.filter((r: any) => r.status === 'validated').length;
      const rejectedReferrals = companyReferrals.filter((r: any) => 
        r.status === 'rejected' || r.status === 'false' || r.status === 'not_converted'
      ).length;

      const conversionRate = validatedReferrals > 0 ? (convertedReferrals / validatedReferrals) * 100 : 0;

      // Calculate commissions based on whether we're filtering by month or not
      let totalCommissionIndicators = 0;
      let totalCommissionPromoters = 0;
      
      if (monthFilter && monthFilter !== "all_time") {
        // Monthly view: calculate only commissions GENERATED in this specific month
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        // Get ALL referrals for the company (not just filtered ones)
        const allCompanyReferrals = await storage.getReferralsByCompanyId(companyId);
        
        for (const referral of allCompanyReferrals) {
          // Check if validated in this month
          if (referral.validatedAt) {
            const validatedDate = new Date(referral.validatedAt);
            if (validatedDate >= startDate && validatedDate <= endDate) {
              totalCommissionIndicators += 3; // Validation commission for indicator
              totalCommissionPromoters += 1; // Validation commission for promoter
            }
          }
          
          // Check if converted in this month
          if ((referral.status === 'converted' || referral.status === 'paid') && referral.updatedAt) {
            const convertedDate = new Date(referral.updatedAt);
            if (convertedDate >= startDate && convertedDate <= endDate) {
              totalCommissionIndicators += 50; // Conversion commission for indicator
              totalCommissionPromoters += 10; // Conversion commission for promoter
            }
          }
        }
      } else {
        // All-time view: use total accumulated commissions
        const paidReferrals = companyReferrals.filter((r: any) => 
          r.status === 'validated' || r.status === 'converted' || r.status === 'paid'
        );
        
        totalCommissionIndicators = paidReferrals.reduce((sum: number, r: any) => 
          sum + (parseFloat(r.commissionIndicator) || 0), 0
        );
        totalCommissionPromoters = paidReferrals.reduce((sum: number, r: any) => 
          sum + (parseFloat(r.commissionPromoter) || 0), 0
        );
      }
      
      const totalCommissions = totalCommissionIndicators + totalCommissionPromoters;

      // Get unique users involved with this company
      const indicatorsInvolved = new Set(companyReferrals.map((r: any) => r.userId));
      const promotersInvolved = new Set(companyReferrals.map((r: any) => r.promoterId).filter(Boolean));

      const totalIndicators = indicatorsInvolved.size;
      const totalPromoters = promotersInvolved.size;

      // Calculate active indicators (those who made referrals in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentReferrals = companyReferrals.filter((r: any) => 
        new Date(r.createdAt) >= thirtyDaysAgo
      ).length;
      
      const activeIndicators = new Set(
        companyReferrals
          .filter((r: any) => new Date(r.createdAt) >= thirtyDaysAgo)
          .map((r: any) => r.userId)
      ).size;

      const averageReferralsPerIndicator = totalIndicators > 0 ? totalReferrals / totalIndicators : 0;

      // For now, set paid values to 0 (same as admin endpoint)
      const totalPaidToIndicators = 0;
      const totalPaidToPromoters = 0;
      const totalPaidValues = 0;

      // Get cash balance from company settings
      const settings = await storage.getCompanySettings(companyId);

      const metrics = {
        companyId,
        companyName: company.name,
        publicToken: company.publicToken,
        cashBalance: parseFloat(settings.cashBalance || '0'),
        totalIndicators,
        totalPromoters,
        totalReferrals,
        convertedReferrals,
        conversionRate,
        averageReferralsPerIndicator,
        totalCommissionIndicators,
        totalCommissionPromoters,
        totalCommissions,
        activeIndicators,
        recentReferrals,
        pendingReferrals,
        analyzingReferrals,
        validatedReferrals,
        rejectedReferrals,
        totalPaidToIndicators,
        totalPaidToPromoters,
        totalPaidValues
      };

      return res.json(metrics);
    } catch (error) {
      console.error("Error fetching public company metrics:", error);
      return res.status(500).json({ error: "Erro ao buscar métricas da empresa" });
    }
  });

  // === WITHDRAWAL ROUTES ===
  
  // Get current user's withdrawal requests
  app.get("/api/withdrawals", requireAuth, forbidRole("indicador_nivel_1", "Usuários do tipo 'Indicador nível 1' não podem acessar funcionalidades de saque"), async (req, res) => {
    try {
      
      const withdrawals = await storage.getWithdrawalRequestsByUserId(req.user!.id);
      return res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      return res.status(500).json({ error: "Erro ao buscar saques" });
    }
  });

  // Create withdrawal request
  app.post("/api/withdrawals", requireAuth, forbidRole("indicador_nivel_1", "Usuários do tipo 'Indicador nível 1' não podem solicitar saques"), async (req, res) => {
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
      
      console.log(`[/api/analyst/referrals] 📊 Analista ${user?.fullName} (ID: ${user?.id}, Nível: ${user?.analystLevel}) solicitando indicações`);
      console.log(`[/api/analyst/referrals] 🔑 Permissões do analista:`, userPermissions);
      
      // If analyst is level 3, only show referrals from supervised users
      let allReferrals;
      if (user?.analystLevel === 3) {
        console.log(`[/api/analyst/referrals] 👥 Carregando indicações para analista nível 3 (supervisor)`);
        allReferrals = await storage.getReferralsBySupervisor(req.user!.id);
        console.log(`[/api/analyst/referrals] 📋 Supervisor ${user?.fullName} tem ${allReferrals.length} indicações dos seus supervisionados`);
      } else {
        console.log(`[/api/analyst/referrals] 🌍 Carregando TODAS as indicações para analista nível ${user?.analystLevel}`);
        allReferrals = await storage.getAllReferrals();
        console.log(`[/api/analyst/referrals] 📋 Total de indicações no sistema: ${allReferrals.length}`);
        
        // Para analistas nível 1, log adicional dos IDs das indicações
        if (user?.analystLevel === 1) {
          const referralIds = allReferrals.map(r => r.id).sort((a, b) => a - b);
          console.log(`[/api/analyst/referrals] 🎯 IDs das indicações para analista nível 1:`, referralIds.slice(0, 10), referralIds.length > 10 ? `... e mais ${referralIds.length - 10}` : '');
          
          // Verificar se há indicações criadas recentemente
          const recentReferrals = allReferrals.filter(r => {
            const createdAt = new Date(r.createdAt);
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return createdAt > hourAgo;
          });
          console.log(`[/api/analyst/referrals] ⏰ Indicações criadas na última hora: ${recentReferrals.length}`);
        }
      }
      
      console.log(`[/api/analyst/referrals] ✅ Retornando ${allReferrals.length} indicações para ${user?.fullName}`);
      return res.json(allReferrals);
    } catch (error) {
      console.error("[/api/analyst/referrals] ❌ Error fetching all referrals for analyst:", error);
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
      const validatedReferrals = referrals.filter(r => r.status === "validated").length;
      const convertedReferrals = referrals.filter(r => r.status === "converted" || r.status === "paid").length;
      
      return res.json({
        totalIndicators,
        totalPromoters,
        totalReferrals,
        pendingReferrals,
        convertedReferrals,
        conversionRate: validatedReferrals > 0 ? (convertedReferrals / validatedReferrals * 100).toFixed(1) : "0"
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

  // Get specific users by IDs (for resolving status history user names)
  app.post("/api/users/by-ids", requireAuth, async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: "Lista de IDs de usuário é obrigatória" });
      }
      
      if (userIds.length === 0) {
        return res.json([]);
      }
      
      // Buscar usuários específicos
      const foundUsers = await Promise.all(
        userIds.map(async (id: number) => {
          try {
            const user = await storage.getUserById(id);
            if (user) {
              const { password, ...userWithoutPassword } = user;
              return userWithoutPassword;
            }
            return null;
          } catch {
            return null;
          }
        })
      );
      
      // Filtrar usuários válidos
      const validUsers = foundUsers.filter(user => user !== null);
      
      return res.json(validUsers);
    } catch (error) {
      console.error("Error fetching users by IDs:", error);
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

  // === METIS VIEWER ROUTES ===

  // Get all referrals for Metis viewer (only Metis da Pix company)
  app.get("/api/metis-viewer/referrals", requireMetisViewer, async (req, res) => {
    try {
      const metisReferrals = await storage.getAllReferralsForMetisViewer();
      return res.json(metisReferrals);
    } catch (error) {
      console.error("Error fetching Metis referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações da Metis" });
    }
  });

  // Get users with Metis referrals
  app.get("/api/metis-viewer/users", requireMetisViewer, async (req, res) => {
    try {
      const metisUsers = await storage.getUsersWithMetisReferrals();
      // Remove passwords from response
      const usersWithoutPasswords = metisUsers.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching Metis users:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários da Metis" });
    }
  });

  // Get Metis viewer stats
  app.get("/api/metis-viewer/stats", requireMetisViewer, async (req, res) => {
    try {
      const metisStats = await storage.getMetisViewerStats();
      return res.json(metisStats);
    } catch (error) {
      console.error("Error fetching Metis stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas da Metis" });
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
      const validatedReferrals = referrals.filter(r => r.status === "validated").length;
      const convertedReferrals = referrals.filter(r => r.status === "converted" || r.status === "paid").length;
      
      return res.json({
        totalIndicadores,
        totalReferrals,
        pendingReferrals,
        convertedReferrals,
        conversionRate: validatedReferrals > 0 ? (convertedReferrals / validatedReferrals * 100).toFixed(1) : "0"
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Update referral status - OPTIMIZED (no duplicate queries)
  app.patch("/api/referrals/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateReferralStatusSchema.parse(req.body);
      
      // updateReferralStatus handles all queries internally - no duplicates
      const result = await storage.updateReferralStatus(
        parseInt(id),
        validatedData.status,
        validatedData.notes,
        req.user!.id
      );
      
      // TODO: Move SMS notification to updateReferralStatus to avoid extra queries
      
      return res.json(result);
    } catch (error) {
      console.error("[/api/referrals/:id/status] Error:", error);
      
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
    } catch (error) {
      console.error("Error exporting referrals:", error);
      return res.status(500).json({ error: "Erro ao exportar indicações" });
    }
  });

  // Validate referral (for analysts and admins with edit_referral_status permission)
  app.patch("/api/referrals/:id/validate", requireAnalyst, async (req, res) => {
    try {
      const referralId = parseInt(req.params.id);
      
      // Check if analyst has edit_referral_status permission
      const user = await storage.getUserById(req.user!.id);
      const userPermissions = user?.permissions as string[] || [];
      if (req.user!.role === "analista" && !userPermissions.includes("edit_referral_status")) {
        console.log(`[VALIDATE] Analista ${user?.fullName} (ID: ${user?.id}) sem permissão edit_referral_status`);
        return res.status(403).json({ error: "Você não tem permissão para validar indicações" });
      }
      
      // Validate request data using shared schema
      const parseResult = validateReferralSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.log(`[VALIDATE] Erro de validação para usuário ${req.user!.id}, indicação ${referralId}:`, parseResult.error.errors);
        return res.status(400).json({ 
          error: "Dados de validação inválidos",
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const validatedData = parseResult.data;
      console.log(`[VALIDATE] Analista ${user?.fullName} (ID: ${user?.id}) validando indicação ${referralId}`);
      
      const updatedReferral = await storage.validateReferral(
        referralId,
        validatedData,
        req.user!.id
      );
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error validating referral:", error);
      return res.status(500).json({ error: "Erro interno do servidor ao validar indicação" });
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
      
      console.log(`[PATCH /api/referrals/:id] Indicação atualizada com sucesso:`, {
        id: updatedReferral.id,
        oldUserId: existingReferral.userId,
        newUserId: updatedReferral.userId,
        oldPromoterId: existingReferral.promoterId,
        newPromoterId: updatedReferral.promoterId,
        updatedBy: req.user!.id,
        updatedByRole: req.user!.role
      });
      
      // Log the update
      await storage.logUserAction({
        userId: req.user!.id,
        action: "update_referral",
        entityType: "referral",
        entityId: referralId,
        oldValues: existingReferral,
        newValues: updatedReferral,
        details: `Dados da indicação ${referralId} atualizados por ${req.user!.role}${userId !== undefined ? ` - Usuário alterado de ${existingReferral.userId} para ${userId}` : ''}`
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

  // Update withdrawal insurance status (admin only)
  app.patch("/api/admin/withdrawals/:id/insurance", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { hasInsurance } = req.body;
      
      if (typeof hasInsurance !== 'boolean') {
        return res.status(400).json({ error: "hasInsurance deve ser true ou false" });
      }
      
      const updated = await storage.updateWithdrawalInsurance(id, hasInsurance);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating withdrawal insurance:", error);
      return res.status(500).json({ error: "Erro ao atualizar adesão" });
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
      
      console.log(`[CREATE INDICADOR] Analyst info:`, {
        id: analyst?.id,
        role: analyst?.role,
        level: analyst?.analystLevel,
        willSetSupervisor: analyst?.role === "analista" && analyst?.analystLevel === 3
      });
      
      // Force role to be indicador and set analyst as creator
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: "indicador",
        createdBy: req.user!.id,
        // If analyst is level 3, set them as supervisor
        supervisorId: (analyst?.role === "analista" && analyst?.analystLevel === 3) ? req.user!.id : undefined
      };
      
      console.log(`[CREATE INDICADOR] Creating with supervisorId:`, userData.supervisorId);
      
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
      
      console.log(`[CREATE PROMOTOR] Analyst info:`, {
        id: analyst?.id,
        role: analyst?.role,
        level: analyst?.analystLevel,
        willSetSupervisor: analyst?.role === "analista" && analyst?.analystLevel === 3
      });
      
      // Force role to be promotor and set analyst as creator
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: "promotor",
        createdBy: req.user!.id,
        // If analyst is level 3, set them as supervisor
        supervisorId: (analyst?.role === "analista" && analyst?.analystLevel === 3) ? req.user!.id : undefined
      };
      
      console.log(`[CREATE PROMOTOR] Creating with supervisorId:`, userData.supervisorId);
      
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
  app.get("/api/team/stats", requireAuth, forbidRole("indicador_nivel_1", "Usuários do tipo 'Indicador nível 1' não podem acessar estatísticas da equipe"), async (req, res) => {
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
  app.post("/api/withdrawals/validate-cpf", requireAuth, forbidRole("indicador_nivel_1", "Usuários do tipo 'Indicador nível 1' não podem acessar funcionalidades de saque"), async (req, res) => {
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

  // New endpoint for assigning indicators to either promoters or analysts
  app.patch("/api/admin/users/:id/assign", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { promoterId, supervisorId } = req.body;
      
      // Get user to check their role
      const user = await storage.getUserById(parseInt(id));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Validation based on user role
      if (user.role === "promotor") {
        // Promoters can only be assigned to analysts, not other promoters
        if (promoterId) {
          return res.status(400).json({ error: "Promotores só podem ser atribuídos a analistas nível 3" });
        }
      } else if (user.role === "indicador") {
        // Indicators can't have both promoter and supervisor
        if (promoterId && supervisorId) {
          return res.status(400).json({ error: "Indicador pode ser atribuído a promotor OU analista, não ambos" });
        }
      }
      
      // Update user with new assignment
      const updatedUser = await storage.assignIndicator(parseInt(id), promoterId, supervisorId);
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Log audit trail
      try {
        let action, details;
        const userType = user.role === "promotor" ? "Promotor" : "Indicador";
        
        if (promoterId) {
          action = "assign_promoter";
          details = `${userType} ${updatedUser.fullName} atribuído ao promotor ID: ${promoterId}`;
        } else if (supervisorId) {
          action = "assign_analyst";
          details = `${userType} ${updatedUser.fullName} atribuído ao analista nível 3 ID: ${supervisorId}`;
        } else {
          action = "unassign_user";
          details = `${userType} ${updatedUser.fullName} removido de atribuição`;
        }
          
        await storage.logUserAction({
          userId: req.user!.id,
          action,
          entityType: 'user',
          entityId: parseInt(id),
          details
        });
      } catch (error) {
        console.warn('Failed to log assignment:', error);
      }
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error assigning indicator:", error);
      return res.status(500).json({ error: "Erro ao atribuir indicador" });
    }
  });
  
  // Assign user to supervisor (admin only)
  app.patch("/api/admin/users/:id/supervisor", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { supervisorId } = req.body;
      
      // Update user with new supervisor assignment
      const updatedUser = await storage.assignUserToSupervisor(parseInt(id), supervisorId);
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Log audit trail
      try {
        const action = supervisorId ? "assign_supervisor" : "unassign_supervisor";
        const details = supervisorId 
          ? `Usuário ${updatedUser.fullName} atribuído ao supervisor ID: ${supervisorId}`
          : `Usuário ${updatedUser.fullName} removido de supervisor`;
          
        await storage.logUserAction({
          userId: req.user!.id,
          action,
          entityType: 'user',
          entityId: parseInt(id),
          details
        });
      } catch (error) {
        console.warn('Failed to log supervisor assignment:', error);
      }
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error assigning supervisor:", error);
      return res.status(500).json({ error: "Erro ao atribuir supervisor" });
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

  // License Plate Search - Available for all authenticated users
  const plateLookupHandler = async (req: any, res: any) => {
    try {
      const { plate } = req.query;
      
      if (!plate || typeof plate !== 'string') {
        return res.status(400).json({ error: "Placa é obrigatória" });
      }
      
      // Clean the plate (remove special characters)
      const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      
      if (cleanPlate.length < 7) {
        return res.status(400).json({ error: "Placa inválida - deve ter 7 caracteres" });
      }
      
      // Search for the plate in referrals
      const referral = await storage.getReferralByPlate(cleanPlate);
      
      if (referral) {
        // Don't expose sensitive information
        return res.json({
          found: true,
          message: "Esta placa já está cadastrada no sistema",
          status: referral.status,
          createdAt: referral.createdAt
        });
      } else {
        return res.json({
          found: false,
          message: "Placa não encontrada - disponível para cadastro"
        });
      }
    } catch (error) {
      console.error("Error searching plate:", error);
      return res.status(500).json({ error: "Erro ao consultar placa" });
    }
  };
  
  // Main route for plate search
  app.get("/api/search-plate", requireAuth, plateLookupHandler);
  
  // Keep backward compatibility with old route
  app.get("/api/indicador/search-plate", requireAuth, plateLookupHandler);

  // REFERRAL LINKS ROUTES
  // Middleware to check referral link permissions (admin, promoter, analyst level 3)
  const requireReferralLinkPermission = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const { role, analystLevel } = req.user;
    const hasPermission = role === "admin" || 
                         role === "promotor" || 
                         (role === "analista" && analystLevel === 3);
    
    if (!hasPermission) {
      return res.status(403).json({ error: "Acesso negado - apenas admins, promotores e analistas nível 3 podem acessar links de referência" });
    }
    next();
  };

  // Middleware to check ownership for update/delete operations
  const requireReferralLinkOwnership = async (req: any, res: any, next: any) => {
    try {
      const linkId = parseInt(req.params.id);
      const link = await storage.getReferralLinkById(linkId);
      
      if (!link) {
        return res.status(404).json({ error: "Link de referência não encontrado" });
      }

      // Admin can access any link, others only their own
      if (req.user.role !== "admin" && link.userId !== req.user.id) {
        return res.status(403).json({ error: "Acesso negado - você só pode modificar seus próprios links" });
      }

      next();
    } catch (error) {
      console.error("Error checking referral link ownership:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  // Create new referral link
  app.post("/api/referral-links", requireReferralLinkPermission, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      const validatedData = createReferralLinkSchema.parse(req.body);
      const referralLink = await storage.createReferralLink(req.user.id, validatedData);
      return res.status(201).json(referralLink);
    } catch (error) {
      console.error("Error creating referral link:", error);
      return res.status(500).json({ error: "Erro ao criar link de referência" });
    }
  });

  // Get user's referral links
  app.get("/api/referral-links", requireReferralLinkPermission, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      const links = await storage.getReferralLinksByUserId(req.user.id);
      return res.json(links);
    } catch (error) {
      console.error("Error fetching referral links:", error);
      return res.status(500).json({ error: "Erro ao buscar links de referência" });
    }
  });

  // Update referral link
  app.patch("/api/referral-links/:id", requireReferralLinkPermission, requireReferralLinkOwnership, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      const linkId = parseInt(req.params.id);
      const validatedData = updateReferralLinkSchema.parse(req.body);
      const updatedLink = await storage.updateReferralLink(linkId, req.user.id, validatedData);
      return res.json(updatedLink);
    } catch (error) {
      console.error("Error updating referral link:", error);
      return res.status(500).json({ error: "Erro ao atualizar link de referência" });
    }
  });

  // Delete referral link
  app.delete("/api/referral-links/:id", requireReferralLinkPermission, requireReferralLinkOwnership, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      const linkId = parseInt(req.params.id);
      await storage.deleteReferralLink(linkId, req.user.id);
      return res.json({ message: "Link de referência excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting referral link:", error);
      return res.status(500).json({ error: "Erro ao excluir link de referência" });
    }
  });

  // Track referral link click (public endpoint)
  app.get("/ref/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Sanitize token - only allow alphanumeric characters, dashes and underscores
      if (!/^[a-zA-Z0-9-_]+$/.test(token)) {
        return res.status(400).json({ error: "Token inválido" });
      }

      await storage.trackReferralLinkClick(token);
      
      // Redirect to signup page with referral token for registration
      return res.redirect(`/signup?ref=${token}`);
    } catch (error) {
      console.error("Error tracking referral link click:", error);
      // Still redirect to signup page even if tracking fails
      return res.redirect("/signup");
    }
  });

  // Regular registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const userData = req.body;
      
      // Create user without referral attribution
      const newUser = await storage.createUser(userData);
      
      return res.status(201).json({ 
        message: "Usuário criado com sucesso", 
        user: { id: newUser.id, username: newUser.username } 
      });
    } catch (error: any) {
      console.error("Error registering user:", error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        if (error.constraint === 'users_cpf_unique') {
          return res.status(400).json({ error: "Este CPF já está cadastrado" });
        } else if (error.constraint === 'users_username_unique') {
          return res.status(400).json({ error: "Este e-mail já está cadastrado" });
        }
      }
      
      return res.status(500).json({ error: "Erro ao cadastrar usuário" });
    }
  });

  // Registration with referral link
  app.post("/api/register-with-referral", async (req, res) => {
    try {
      const { referralToken, userData } = req.body;
      
      // Create user with referral attribution
      const newUser = await storage.createUserWithReferralAttribution(userData, referralToken);
      
      return res.status(201).json({ 
        message: "Usuário criado com sucesso", 
        user: { id: newUser.id, username: newUser.username } 
      });
    } catch (error: any) {
      console.error("Error registering user with referral:", error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        if (error.constraint === 'users_cpf_unique') {
          return res.status(400).json({ error: "Este CPF já está cadastrado" });
        } else if (error.constraint === 'users_username_unique') {
          return res.status(400).json({ error: "Este e-mail já está cadastrado" });
        }
      }
      
      return res.status(500).json({ error: "Erro ao cadastrar usuário" });
    }
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}