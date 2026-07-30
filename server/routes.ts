import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth, hashPassword, sessionMiddleware } from "./auth";
import { checkPixKeyOwnership } from "./pixValidation";
import { safeCompare } from "./secrets";
import { normalizarPlaca } from "@shared/cpf";
import { storage, InsufficientBalanceError, ConcurrentStatusChangeError } from "./storage";
import { db } from "@db";
import { z } from "zod";
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
  insertUserSchema,
  type AnalystPermission,
  type ManagerPermission,
  type WithdrawalStatus
} from "@shared/schema";
import { 
  registerCrossAppValidationRoutes,
  validateUserDuplicates,
  validateReferralDuplicates 
} from "./crossAppValidation";
import { attachTenantMiddleware, getCurrentTenant } from "./tenancy";

/**
 * Teto do rateio por lead. R$4 = R$3 indicador + R$1 promotor (validado);
 * R$60 = R$50 + R$10 (convertido). Limite superior ao aceitar valores de
 * comissão vindos do cliente.
 */
const REFERRAL_POOL_VALIDATED = 4;
const REFERRAL_POOL_CONVERTED = 60;

/**
 * Limite de corpo para as rotas que recebem comprovante em base64.
 * O limite global (server/index.ts) é pequeno de propósito, para que ninguém
 * consiga mandar megabytes contra rotas sem autenticação.
 */
const COMPROVANTE_LIMITE = process.env.UPLOAD_LIMIT ?? '8mb';

/**
 * Converte valor monetário vindo do cliente, ou null se não for número válido.
 *
 * `parseFloat` é armadilha aqui por dois motivos:
 *  1. `parseFloat("12abc")` devolve 12 — aceita lixo silenciosamente;
 *  2. `parseFloat("abc")` devolve NaN, e NaN falha TODA comparação:
 *     `NaN < 0` é false e `NaN > 4` também é false, então validação de faixa
 *     deixa passar. O Postgres aceita 'NaN' em coluna numeric e
 *     `NaN + 3.00 = NaN`: o saldo do usuário vira NaN e não há cálculo que o
 *     traga de volta.
 *
 * `Number()` é estrito (rejeita "12abc") e `Number.isFinite` barra NaN e
 * Infinity de uma vez.
 */
function parseMoney(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  /**
   * Valida `:id` uma vez só, para todas as rotas.
   *
   * Dezenas de rotas faziam `parseInt(req.params.id)` sem checar o resultado.
   * `/api/tickets/abc` virava `NaN`, o Postgres recusava a consulta e o
   * usuário recebia 500 — erro de servidor para o que é entrada inválida.
   * Pior: mascarava problema real no meio de ruído.
   */
  app.param("id", (req, res, next, valor) => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    next();
  });

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
      'not_converted': 'Não convertido',
      'contact_list': 'Lista de contato'
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

  // Middleware to check if user can edit referral status (admin or analyst with permission)
  const requireStatusEditPermission = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    // Admin always has permission
    if (req.user.role === "admin") {
      return next();
    }
    
    // Check if analyst has edit_referral_status permission
    if (req.user.role === "analista") {
      try {
        const user = await storage.getUserById(req.user.id);
        const userPermissions = user?.permissions as string[] || [];
        if (userPermissions.includes("edit_referral_status")) {
          return next();
        }
      } catch (error) {
        console.error("[requireStatusEditPermission] Error checking permissions:", error);
        return res.status(500).json({ error: "Erro ao verificar permissões" });
      }
    }
    
    // Allow indicador_nivel_1 to convert their own validated referrals to converted
    if (req.user.role === "indicador_nivel_1") {
      try {
        const referralId = parseInt(req.params.id);
        const referral = await storage.getReferralById(referralId);
        
        if (!referral) {
          return res.status(404).json({ error: "Indicação não encontrada" });
        }
        
        // Check if the referral was created by this user
        if (referral.createdBy !== req.user.id) {
          return res.status(403).json({ error: "Você só pode converter indicações que você criou" });
        }
        
        // Check if current status is validated and target status is converted
        const targetStatus = req.body?.status;
        if (referral.status !== 'validated') {
          return res.status(403).json({ error: "Você só pode converter indicações com status 'Validado'" });
        }
        
        if (targetStatus !== 'converted') {
          return res.status(403).json({ error: "Você só pode alterar o status para 'Convertido'" });
        }
        
        return next();
      } catch (error) {
        console.error("[requireStatusEditPermission] Error checking indicador_nivel_1 permissions:", error);
        return res.status(500).json({ error: "Erro ao verificar permissões" });
      }
    }
    
    return res.status(403).json({ error: "Você não tem permissão para editar status de indicações" });
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
  
  // Get current user's referrals with server-side pagination and search
  app.get("/api/referrals", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      // For indicador_nivel_1, get referrals by createdBy and FORCE status to "validated"
      let result;
      if (req.user!.role === 'indicador_nivel_1') {
        // indicador_nivel_1 can ONLY see validated referrals - no filter option
        result = await storage.getReferralsByCreatorPaginated(
          req.user!.id,
          page,
          limit,
          'validated', // Always filter by validated status
          search
        );
      } else if (req.user!.role === 'analista') {
        /**
         * Filtro, busca e paginação agora acontecem no BANCO.
         * Antes isto carregava a tabela inteira de indicações a cada
         * requisição e fatiava em memória — inviável no volume do evento.
         */
        const user = await storage.getUserById(req.user!.id);
        const finalStatus = status && status !== 'all' ? status : undefined;

        let restringirAUsuarios: number[] | undefined;
        if (user?.analystLevel === 3) {
          // Nível 3 enxerga apenas a própria equipe
          const supervisionados = await storage.getAllUsersBySupervisor(req.user!.id);
          restringirAUsuarios = supervisionados.map((u: any) => u.id);
        }

        result = await storage.getReferralsPaginatedForAnalyst(
          page,
          limit,
          finalStatus,
          search,
          restringirAUsuarios,
        );
      } else {
        const finalStatus = status && status !== 'all' ? status : undefined;
        result = await storage.getReferralsByUserIdPaginated(
          req.user!.id,
          page,
          limit,
          finalStatus,
          search
        );
      }
      
      return res.json(result);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });
  
  // Get user details by ID (for fetching supervisor info)
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }

      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      /**
       * Este endpoint só exigia autenticação: qualquer usuário logado lia o
       * cadastro completo de qualquer outro (CPF, chave PIX, telefone, saldo,
       * papel). Agora o acesso é restrito à própria conta, aos papéis que já
       * enxergam a base inteira e à hierarquia direta do solicitante.
       */
      const me = req.user!;
      const isSelf = user.id === me.id;
      const isPrivileged =
        me.role === "admin" || me.role === "analista" || me.role === "gerente";

      // Alguém acima na hierarquia do solicitante (ex.: promotor vendo seu supervisor)
      const isMyUpline = [
        me.supervisorId,
        me.promoterId,
        me.analystId,
        me.teamSupervisorId,
      ].some((linkedId) => linkedId != null && linkedId === user.id);

      // Alguém da equipe do solicitante
      const isMyDownline =
        (user.promoterId != null && user.promoterId === me.id) ||
        (user.supervisorId != null && user.supervisorId === me.id) ||
        (user.teamSupervisorId != null && user.teamSupervisorId === me.id) ||
        (user.analystId != null && user.analystId === me.id);

      if (!isSelf && !isPrivileged && !isMyUpline && !isMyDownline) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Quem não é dono do registro nem tem papel privilegiado recebe apenas
      // identificação — dados sensíveis e financeiros não saem daqui.
      if (!isSelf && !isPrivileged) {
        return res.json({
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        });
      }

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
      
      // 1. Verificar limite de 100 referrals por dia (não aplicar para indicador_nivel_1 e admin)
      if (req.user!.role !== "indicador_nivel_1" && req.user!.role !== "admin") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayReferrals = await storage.getTodayReferralsByUserId(req.user!.id, today);
        
        if (todayReferrals.length >= 100) {
          return res.status(400).json({ 
            error: "Limite diário atingido",
            details: `Você já cadastrou ${todayReferrals.length} clientes hoje. Limite máximo: 100 por dia.`
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
        try {
          const referralForPlate = await storage.createReferral({
            ...referralDataWithoutPlates,
            licensePlates: [plate], // Pass single plate in array for storage
            userId: req.user!.id,
            createdBy: req.user!.id
          });
          console.log(`[CREATE REFERRAL] Created referral ID: ${referralForPlate.id} for plate: ${plate}`);
          createdReferrals.push(referralForPlate);
        } catch (error: any) {
          /**
           * 23505 = violação de unicidade. O índice único no banco é a última
           * linha de defesa contra duplicata: a checagem em memória logo acima
           * consulta e só depois insere, e nesse intervalo dois envios
           * simultâneos da mesma placa passavam os dois — gerando duas
           * indicações e comissão em dobro pelo mesmo carro.
           */
          if (error?.code === '23505') {
            return res.status(400).json({
              error: "Indicação duplicada",
              details: `A placa ${plate} já foi cadastrada.`,
              duplicatedPlate: plate,
            });
          }
          throw error;
        }
      }
      
      console.log(`[CREATE REFERRAL] Total referrals created: ${createdReferrals.length}`);

      // Send SMS notification to user about new referral(s)
      const user = await storage.getUserById(req.user!.id);
      if (user?.phone && createdReferrals.length > 0) {
        try {
          const { sendReferralNotification } = await import('./sms-service');
          // Send notification for first referral (or we could mention "X placas cadastradas")
          // Sem await: o indicador não pode esperar a Comtele para ver o
          // cadastro concluído.
          void sendReferralNotification(
            user.phone,
            user.fullName,
            createdReferrals[0].id
          ).catch((e) => console.log('SMS de indicação falhou (non-critical):', e?.message ?? e));
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
      const corpo = z
        .object({
          phone: z.string().max(20).optional(),
          licensePlate: z.string().max(10).optional(),
          licensePlates: z.array(z.string().max(10)).max(3).optional(),
        })
        .safeParse(req.body);

      if (!corpo.success) {
        return res.status(400).json({ error: "Dados inválidos para verificação" });
      }

      const { phone, licensePlate, licensePlates } = corpo.data;

      // Support both single plate (legacy) and multiple plates (new)
      const platesToCheck = licensePlates ?? (licensePlate ? [licensePlate] : []);
      const platesNormalizadas = platesToCheck.map(normalizarPlaca);

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

      /**
       * Projeção mínima.
       *
       * Antes a resposta fazia spread da LINHA INTEIRA da indicação: nome
       * completo do lead, telefone, placa e id. Qualquer usuário autenticado
       * sondava por telefone ou placa e recebia o cadastro de leads de outras
       * equipes — uma base de dados pessoais consultável.
       *
       * O aviso legítimo ("essa placa já existe") precisa apenas de: quem
       * cadastrou (primeiro nome + UF) e quando. Telefone e placa só voltam
       * quando são os MESMOS que o solicitante enviou — valor que ele já
       * conhece, porque acabou de digitar.
       */
      const telefoneEnviado = phone ? String(phone) : null;

      return res.json({
        isDuplicate: allDuplicates.length > 0,
        duplicates: allDuplicates.map((d) => ({
          phone: telefoneEnviado && d.phone === telefoneEnviado ? d.phone : undefined,
          licensePlate: platesNormalizadas.includes(normalizarPlaca(d.licensePlate ?? ""))
            ? d.licensePlate
            : undefined,
          ownerFirstName: d.createdByFirstName,
          ownerState: d.createdByState,
          createdAt: d.createdAt,
        })),
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
      
      // For indicador_nivel_1 and admin users, return unlimited stats
      if (req.user!.role === "indicador_nivel_1" || req.user!.role === "admin") {
        return res.json({
          count: todayReferrals.length,
          limit: null,
          remaining: null,
          isUnlimited: true
        });
      }
      
      // For all other users, return standard 100-limit stats
      return res.json({
        count: todayReferrals.length,
        limit: 100,
        remaining: Math.max(0, 100 - todayReferrals.length),
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
                       referral.createdBy === req.user!.id ||
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
      
      // Check if it's a FULLY numeric ID (backward compatibility)
      // Use regex to ensure the ENTIRE string is numeric, not just starts with a number
      const isFullyNumeric = /^\d+$/.test(tokenOrId);
      if (isFullyNumeric) {
        const numericId = parseInt(tokenOrId);
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

      /**
       * Agregação no BANCO.
       *
       * Antes: carregava TODAS as indicações da empresa, filtrava e somava em
       * JavaScript — e no recorte mensal carregava a lista inteira uma SEGUNDA
       * vez. Sendo rota pública e sem autenticação, bastava recarregar a página
       * para o servidor repetir tudo.
       */
      let periodo: { inicio: Date; fim: Date } | undefined;
      if (monthFilter && monthFilter !== "all_time") {
        const [year, month] = monthFilter.split('-');
        const ano = parseInt(year);
        const mes = parseInt(month);
        if (Number.isInteger(ano) && Number.isInteger(mes) && mes >= 1 && mes <= 12) {
          periodo = {
            inicio: new Date(ano, mes - 1, 1),
            fim: new Date(ano, mes, 0, 23, 59, 59),
          };
        }
      }

      const m = await storage.getCompanyPublicMetrics(companyId, periodo);

      const totalReferrals = m.total;
      const convertedReferrals = m.convertidas;
      const pendingReferrals = m.pendentes;
      const analyzingReferrals = m.analisando;
      const validatedReferrals = m.validadas;
      const rejectedReferrals = m.rejeitadas;

      const conversionRate = validatedReferrals > 0 ? (convertedReferrals / validatedReferrals) * 100 : 0;

      const totalCommissionIndicators = m.comissaoIndicadores;
      const totalCommissionPromoters = m.comissaoPromotores;
      const totalCommissions = totalCommissionIndicators + totalCommissionPromoters;

      const totalIndicators = m.indicadores;
      const totalPromoters = m.promotores;
      const recentReferrals = m.recentes;
      const activeIndicators = m.indicadoresAtivos;

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
      
      // Pré-checagem só para dar erro cedo e barato. A garantia real está no
      // débito condicional dentro de storage.createWithdrawalRequest — esta
      // leitura sozinha não protege contra dois pedidos simultâneos.
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
      
      /**
       * Titularidade do saque.
       *
       * 1. O CPF informado precisa ser o do titular da conta. Não existe caso
       *    legítimo de sacar declarando o CPF de outra pessoa — trava dura.
       * 2. A chave PIX precisa corresponder ao CPF, celular ou e-mail do
       *    cadastro. Se não corresponder, o saque NÃO é recusado: entra como
       *    "retido" para intermediação do financeiro.
       *
       * Antes disso aqui não havia validação nenhuma: dava para pedir saque
       * para chave de terceiro declarando CPF de terceiro, e o pedido era
       * aceito normalmente.
       */
      if (!(await storage.validateCpfForWithdrawal(req.user!.id, validatedData.cpfKey))) {
        return res.status(400).json({
          error: "CPF inválido",
          details: "O CPF informado precisa ser o mesmo do seu cadastro. O saque só pode ser feito para conta de sua titularidade.",
        });
      }

      const pixCheck = checkPixKeyOwnership(validatedData.pixKey, {
        cpf: user.cpf,
        phone: user.phone,
        email: user.email,
        username: user.username,
      });

      // O débito do saldo acontece DENTRO desta chamada, na mesma transação e
      // de forma condicional. Não debite de novo aqui.
      let withdrawal;
      try {
        withdrawal = await storage.createWithdrawalRequest({
          ...validatedData,
          userId: req.user!.id,
          requestType: user.role === 'promotor' ? 'promotor' : 'indicador',
          status: pixCheck.matchesOwner ? 'pending' : 'retido',
          notes: pixCheck.matchesOwner
            ? undefined
            : `Retido para intermediação: ${pixCheck.reason} (tipo detectado: ${pixCheck.kind})`,
        });
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          return res.status(400).json({ error: "Saldo insuficiente" });
        }
        throw error;
      }

      // Send SMS notification to admins about new withdrawal request
      try {
        const { sendAdminWithdrawalNotification } = await import('./sms-service');
        const admins = await storage.getUsersByRole('admin');
        
        // Em paralelo e fora do caminho da resposta. Antes era um laço
        // sequencial COM await: com 5 admins, o usuário esperava 5 chamadas
        // externas para ver o saque confirmado.
        void Promise.allSettled(
          admins
            .filter((admin) => admin.phone)
            .map((admin) =>
              sendAdminWithdrawalNotification(
                admin.phone,
                user.fullName,
                user.cpf,
                validatedData.amount
              )
            )
        ).then(() => {
          console.log(`SMS de novo saque disparado para ${admins.filter((a) => a.phone).length} admin(s)`);
        });
      } catch (smsError) {
        console.log('Admin SMS notification failed (non-critical):', smsError);
        // Don't fail the withdrawal creation if SMS fails
      }
      
      // O usuário precisa saber na hora que o valor ficou retido e por quê.
      if (!pixCheck.matchesOwner) {
        return res.status(201).json({
          ...withdrawal,
          retained: true,
          message:
            "Saque registrado, mas retido para conferência. A chave PIX informada não corresponde ao CPF, celular ou e-mail do seu cadastro. " +
            "O valor já saiu do saldo disponível e será liberado após intermediação do financeiro.",
        });
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
      // Era getSupportTicketById(req.user!.id): passava o ID do USUÁRIO como ID
      // do TICKET. O usuário #5 recebia o ticket #5, fosse de quem fosse — e
      // com o dono do ticket embutido junto.
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
      
      // Get promoter info to check if they have a supervisor
      const promoter = await storage.getUserById(req.user!.id);
      
      // Special case: certain promoters only create indicador_nivel_1
      const specialPromoterEmails = ['marcelomacedo@gmail.com', 'wescleygondim@yahoo.com.br'];
      const isSpecialPromoter = specialPromoterEmails.includes(promoter?.username?.toLowerCase() || '');
      const indicadorRole = isSpecialPromoter ? "indicador_nivel_1" as const : "indicador" as const;
      
      // Add promoter relationship
      const userData = {
        ...validatedData,
        promoterId: req.user!.id,
        createdBy: req.user!.id,
        analystId: undefined, // Explicitly set to undefined
        // Set the promoter as supervisor of the indicador
        supervisorId: req.user!.id,
        role: indicadorRole
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
      // getAllUsers() já não seleciona a coluna password no banco
      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Get all referrals (with optional pagination)
  app.get("/api/admin/referrals", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const paginated = req.query.paginated === 'true';
      
      if (paginated) {
        const result = await storage.getAllReferralsPaginated(page, limit);
        return res.json(result);
      } else {
        const allReferrals = await storage.getAllReferrals();
        return res.json(allReferrals);
      }
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
      
      // getAllUsers() já não seleciona a coluna password no banco
      return res.json(allUsers);
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

      /**
       * Este endpoint devolvia o cadastro COMPLETO de qualquer ID informado,
       * para qualquer usuário autenticado — era o mesmo IDOR de /api/users/:id,
       * porém em lote. Além disso não havia limite de tamanho: uma lista com
       * milhares de IDs virava a mesma quantidade de consultas ao banco.
       *
       * Ele existe apenas para resolver NOMES no histórico de status, então
       * agora devolve somente campos de identificação.
       */
      const MAX_IDS = 200;

      const ids = Array.from(
        new Set(
          userIds
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0),
        ),
      );

      if (ids.length === 0) {
        return res.json([]);
      }

      if (ids.length > MAX_IDS) {
        return res.status(400).json({
          error: `Máximo de ${MAX_IDS} IDs por requisição`,
        });
      }

      const foundUsers = await Promise.all(
        ids.map(async (id: number) => {
          try {
            const user = await storage.getUserById(id);
            if (!user) return null;
            return {
              id: user.id,
              fullName: user.fullName,
              username: user.username,
              role: user.role,
            };
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

  // Get basic stats (accessible by admin and analyst) - OPTIMIZED with aggregations
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      // Only admin and analyst can access
      if (req.user!.role !== "admin" && req.user!.role !== "analista") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Use efficient aggregation queries instead of loading all data
      const stats = await storage.getAdminStats();
      
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Update referral status - OPTIMIZED (no duplicate queries)
  // Accessible by admin or analyst with edit_referral_status permission
  // Comprovante em base64 só trafega nestas duas rotas, e só depois da
  // autenticação — o limite global de payload é pequeno (ver server/index.ts).
  const aceitaComprovante = express.json({ limit: COMPROVANTE_LIMITE });

  app.patch("/api/referrals/:id/status", requireStatusEditPermission, aceitaComprovante, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateReferralStatusSchema.parse(req.body);
      
      // Get current referral to check if it already has payment proof
      const currentReferral = await storage.getReferralById(parseInt(id));
      if (!currentReferral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Validate payment proof requirement for converted status
      if (validatedData.status === "converted") {
        // If referral is being converted and doesn't have proof yet, require it
        if (!currentReferral.paymentProof && !validatedData.paymentProof) {
          return res.status(400).json({ 
            error: "Comprovante de pagamento obrigatório",
            message: "Para converter uma indicação é obrigatório anexar um comprovante de pagamento."
          });
        }
      }
      
      // updateReferralStatus handles all queries internally - no duplicates
      let result;
      try {
        result = await storage.updateReferralStatus(
          parseInt(id),
          validatedData.status,
          validatedData.notes,
          req.user!.id,
          validatedData.paymentProof,
          req.user!.fullName || req.user!.username
        );
      } catch (error) {
        // Outra requisição transicionou esta indicação primeiro (duplo clique,
        // retry do cliente). Nenhuma comissão foi creditada — a transação foi
        // desfeita. 409 para o cliente saber que deve recarregar.
        if (error instanceof ConcurrentStatusChangeError) {
          return res.status(409).json({
            error: "Indicação já atualizada",
            details: error.message,
          });
        }
        throw error;
      }

      // Add observation as a conversation message if provided
      if (validatedData.observation && validatedData.observation.trim()) {
        await storage.createReferralConversation({
          referralId: parseInt(id),
          userId: req.user!.id,
          message: validatedData.observation.trim(),
          messageType: "comment",
          isInternal: false
        });
      }
      
      // Broadcast real-time update to all connected clients
      if ((app as any).broadcastUpdate) {
        (app as any).broadcastUpdate('referral_updated', result);
      }
      
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

  // Edit referral (for analysts, admins, and indicador_nivel_1 for company only)
  app.patch("/api/referrals/:id", requireAuth, aceitaComprovante, async (req, res) => {
    try {
      const isAdminOrAnalyst = req.user!.role === "admin" || req.user!.role === "analista";
      const isIndicadorNivel1 = req.user!.role === "indicador_nivel_1";
      
      // Check if user has permission to edit
      if (!isAdminOrAnalyst && !isIndicadorNivel1) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const referralId = parseInt(req.params.id);
      const { fullName, phone, licensePlate, companyId, userId, commissionIndicator, commissionPromoter, status, notes, hasInsurance, createdAt, paymentProof, city, state } = req.body;
      
      // For indicador_nivel_1, only allow editing companyId
      if (isIndicadorNivel1) {
        // Verify this is only a company update
        const allowedFields = ['companyId'];
        const requestedFields = Object.keys(req.body).filter(key => req.body[key] !== undefined);
        const hasOnlyAllowedFields = requestedFields.every(field => allowedFields.includes(field));
        
        if (!hasOnlyAllowedFields || companyId === undefined) {
          return res.status(403).json({ error: "Indicador nível 1 só pode alterar a seguradora" });
        }
      }
      
      /**
       * Esta rota NÃO muda status.
       *
       * Ela escreve direto na tabela, sem passar por updateReferralStatus —
       * ou seja, sem creditar nem estornar comissão. Um analista marcava a
       * indicação como 'validated' por aqui e ela ficava validada com ninguém
       * pago, e os campos de comissão dessincronizados do saldo real. Pior:
       * o valor gravado vira o `previousCommission` da próxima transição, que
       * calcula o crédito como diferença.
       *
       * Mudança de status tem uma rota só: PATCH /api/referrals/:id/status,
       * que roda o rateio dentro de transação com guarda de concorrência.
       * Nenhum cliente manda `status` para cá — o formulário de edição do
       * admin não tem esse campo.
       */
      if (status !== undefined) {
        return res.status(400).json({
          error: "Status não pode ser alterado por esta rota",
          details: "Use PATCH /api/referrals/:id/status, que aplica o rateio de comissão corretamente.",
        });
      }

      console.log("[PATCH /api/referrals/:id] Dados recebidos:", req.body);

      // Check if referral exists
      const existingReferral = await storage.getReferralById(referralId);
      if (!existingReferral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // For indicador_nivel_1, verify they own this referral
      if (isIndicadorNivel1 && existingReferral.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Você só pode editar suas próprias indicações" });
      }
      
      // Validate payment proof requirement for converted status
      // Check both: if setting to converted, or if already converted
      const isConverting = status === "converted";
      const isAlreadyConverted = existingReferral.status === "converted";
      
      if (isConverting || isAlreadyConverted) {
        // Check if we have a valid payment proof (existing or new)
        const hasExistingProof = existingReferral.paymentProof && existingReferral.paymentProof.trim().length > 0;
        const hasNewProof = paymentProof && typeof paymentProof === 'string' && paymentProof.trim().length > 0;
        
        // If converting without existing proof, require new proof
        if (isConverting && !hasExistingProof && !hasNewProof) {
          return res.status(400).json({ 
            error: "Comprovante obrigatório",
            message: "Para converter uma indicação é obrigatório anexar um comprovante de pagamento."
          });
        }
        
        // Prevent clearing proof from converted referrals (reject null/empty paymentProof)
        if (paymentProof !== undefined && !hasNewProof) {
          return res.status(400).json({ 
            error: "Comprovante inválido",
            message: "Não é permitido remover o comprovante de uma indicação convertida."
          });
        }
      }
      
      // Prepare update data
      const updateData: any = {};
      
      // Only include fields that were sent in the request
      if (fullName !== undefined) updateData.fullName = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (licensePlate !== undefined) updateData.licensePlate = licensePlate;
      if (companyId !== undefined) updateData.companyId = parseInt(companyId);
      if (notes !== undefined) updateData.notes = notes;
      if (hasInsurance !== undefined) updateData.hasInsurance = hasInsurance;

      /**
       * Comissão e dono da indicação: só admin, e sempre validados.
       *
       * Antes, QUALQUER analista gravava commissionIndicator/commissionPromoter
       * direto do corpo da requisição, sem validação de tipo nem teto de pool —
       * e podia reatribuir a indicação para outro indicador via `userId`.
       *
       * O estrago não é só o valor gravado: updateReferralStatus calcula o
       * crédito como `comissão final - comissão anterior`. Gravando um valor
       * negativo aqui, a próxima transição de status gera uma diferença enorme
       * e credita a diferença como saldo real.
       */
      const isAdmin = req.user!.role === "admin";

      if (commissionIndicator !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Apenas admin pode alterar comissões" });
        }
        const n = parseMoney(commissionIndicator);
        if (n === null || n < 0 || n > REFERRAL_POOL_CONVERTED) {
          return res.status(400).json({
            error: "Comissão do indicador inválida",
            details: `Deve ser um número entre R$0 e R$${REFERRAL_POOL_CONVERTED}`,
          });
        }
        updateData.commissionIndicator = n.toFixed(2);
      }

      if (commissionPromoter !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Apenas admin pode alterar comissões" });
        }
        const n = parseMoney(commissionPromoter);
        if (n === null || n < 0 || n > REFERRAL_POOL_CONVERTED) {
          return res.status(400).json({
            error: "Comissão do promotor inválida",
            details: `Deve ser um número entre R$0 e R$${REFERRAL_POOL_CONVERTED}`,
          });
        }
        updateData.commissionPromoter = n.toFixed(2);
      }

      if (userId !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Apenas admin pode reatribuir a indicação a outro usuário" });
        }
        const novoDono = parseInt(userId);
        if (!Number.isInteger(novoDono) || novoDono <= 0) {
          return res.status(400).json({ error: "Usuário inválido" });
        }
        updateData.userId = novoDono;
      }
      if (paymentProof !== undefined) updateData.paymentProof = paymentProof;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      
      // Only allow admin to change createdAt
      if (createdAt !== undefined && req.user!.role === "admin") {
        updateData.createdAt = new Date(createdAt);
        console.log("[PATCH /api/referrals/:id] Admin alterando data de criação:", { old: existingReferral.createdAt, new: updateData.createdAt });
      }
      
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
      
      // Broadcast real-time update to all connected clients
      if ((app as any).broadcastUpdate) {
        (app as any).broadcastUpdate('referral_updated', updatedReferral);
      }
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral:", error);
      return res.status(500).json({ error: "Erro ao editar indicação" });
    }
  });

  // Update contact status (independent from referral status)
  app.patch("/api/referrals/:id/contact-status", requireAuth, async (req, res) => {
    try {
      // Allow admins, analysts, indicators (all levels), promoters, sellers, and managers to update contact status
      const allowedRoles = ["admin", "analista", "indicador", "indicador_nivel_1", "promotor", "vendedor", "gerente"];
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const referralId = parseInt(req.params.id);
      const { contactStatus } = req.body;
      
      // Validate contact status value
      const validContactStatuses = ["retornar_contato", "sem_sucesso", "em_negociacao", "aguardando_pagamento", "enviar_cotacao", null];
      if (!validContactStatuses.includes(contactStatus)) {
        return res.status(400).json({ error: "Status de contato inválido" });
      }
      
      // Check if referral exists
      const existingReferral = await storage.getReferralById(referralId);
      if (!existingReferral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }

      /**
       * A rota só checava o PAPEL do usuário, não se a indicação é dele.
       * Qualquer indicador logado podia alterar o status de contato de
       * qualquer lead do sistema — inclusive de outra equipe — e ainda
       * carimbava o próprio nome no histórico.
       *
       * Mesma regra de acesso já usada em /api/referrals/:id/conversations.
       */
      const solicitante = req.user!;
      const podeMexer =
        solicitante.role === "admin" ||
        solicitante.role === "analista" ||
        solicitante.role === "gerente" ||
        solicitante.role === "vendedor" ||
        existingReferral.userId === solicitante.id ||
        existingReferral.createdBy === solicitante.id ||
        (solicitante.role === "promotor" && existingReferral.promoterId === solicitante.id);

      if (!podeMexer) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Import required Drizzle functions
      const { eq } = await import('drizzle-orm');
      const { referrals } = await import('@shared/schema.ts');
      
      // Contact status labels for history
      const contactStatusLabels: Record<string, string> = {
        retornar_contato: "Retornar Contato",
        sem_sucesso: "Sem Sucesso",
        em_negociacao: "Em negociação",
        aguardando_pagamento: "Aguardando pagamento",
        enviar_cotacao: "Enviar cotação"
      };
      
      // Create status history entry for contact status change
      const statusHistoryEntry = {
        status: 'contact_status',
        changedBy: req.user!.id,
        changedByName: req.user!.fullName || req.user!.username,
        changedAt: new Date().toISOString(),
        notes: contactStatus 
          ? `Status de contato: ${contactStatusLabels[contactStatus] || contactStatus}`
          : `Status de contato removido`
      };
      
      const newHistory = [...(existingReferral.statusHistory || []), statusHistoryEntry];
      
      // Update contact status and add to history
      const result = await db
        .update(referrals)
        .set({
          contactStatus: contactStatus,
          contactStatusUpdatedAt: new Date(),
          contactStatusUpdatedBy: req.user!.id,
          statusHistory: newHistory as any,
          updatedAt: new Date()
        })
        .where(eq(referrals.id, referralId))
        .returning();
      
      console.log(`[CONTACT STATUS] User ${req.user!.id} updated referral ${referralId} contact status to ${contactStatus}`);
      
      // Log the update
      await storage.logUserAction({
        userId: req.user!.id,
        action: "update_contact_status",
        entityType: "referral",
        entityId: referralId,
        oldValues: { contactStatus: existingReferral.contactStatus },
        newValues: { contactStatus },
        details: `Status de contato da indicação ${referralId} alterado para ${contactStatus || 'nenhum'}`
      });
      
      // Broadcast real-time update to all connected clients
      if ((app as any).broadcastUpdate) {
        (app as any).broadcastUpdate('referral_updated', result[0]);
      }
      
      return res.json(result[0]);
    } catch (error) {
      console.error("Error updating contact status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status de contato" });
    }
  });

  // Update indicator payment status (for special promoters Marcelo Macedo and Wescley Gondim)
  app.patch("/api/referrals/:id/indicator-payment-status", requireAuth, async (req, res) => {
    try {
      // Only allow users with special emails (Marcelo Macedo and Wescley Gondim) regardless of their role
      const specialPromoterEmails = ['marcelomacedo@gmail.com', 'wescleygondim@yahoo.com.br'];
      const userEmail = req.user!.username?.toLowerCase() || '';
      
      if (!specialPromoterEmails.includes(userEmail)) {
        return res.status(403).json({ error: "Apenas promotores autorizados podem atualizar status de pagamento" });
      }

      const referralId = parseInt(req.params.id);
      const { indicatorPaymentStatus } = req.body;
      
      // Validate payment status value
      const validPaymentStatuses = ["paid", "not_paid"];
      if (!validPaymentStatuses.includes(indicatorPaymentStatus)) {
        return res.status(400).json({ error: "Status de pagamento inválido" });
      }
      
      // Check if referral exists
      const existingReferral = await storage.getReferralById(referralId);
      if (!existingReferral) {
        return res.status(404).json({ error: "Indicação não encontrada" });
      }
      
      // Check if the referral belongs to this promoter (via referral.promoterId or indicator.promoterId)
      const indicator = await storage.getUserById(existingReferral.userId);
      const isOwner = existingReferral.promoterId === req.user!.id || indicator?.promoterId === req.user!.id;
      if (!isOwner) {
        return res.status(403).json({ error: "Esta indicação não pertence a um indicador seu" });
      }
      
      // Only allow updating payment status for validated or converted referrals
      const allowedStatuses = ['validated', 'converted', 'paid'];
      if (!allowedStatuses.includes(existingReferral.status)) {
        return res.status(400).json({ error: "Só é possível marcar pagamento para indicações validadas ou convertidas" });
      }
      
      // Import required Drizzle functions
      const { eq } = await import('drizzle-orm');
      const { referrals } = await import('@shared/schema.ts');
      
      // Payment status labels for history
      const paymentStatusLabels: Record<string, string> = {
        paid: "Pago",
        not_paid: "Não Pago"
      };
      
      // Create status history entry for payment status change
      const statusHistoryEntry = {
        status: 'indicator_payment_status',
        changedBy: req.user!.id,
        changedByName: req.user!.fullName || req.user!.username,
        changedAt: new Date().toISOString(),
        notes: `Pagamento ao indicador: ${paymentStatusLabels[indicatorPaymentStatus]}`
      };
      
      const newHistory = [...(existingReferral.statusHistory || []), statusHistoryEntry];
      
      // Update indicator payment status and add to history
      const result = await db
        .update(referrals)
        .set({
          indicatorPaymentStatus: indicatorPaymentStatus,
          indicatorPaymentStatusUpdatedAt: new Date(),
          indicatorPaymentStatusUpdatedBy: req.user!.id,
          statusHistory: newHistory as any,
          updatedAt: new Date()
        })
        .where(eq(referrals.id, referralId))
        .returning();
      
      console.log(`[INDICATOR PAYMENT STATUS] Promoter ${req.user!.id} updated referral ${referralId} payment status to ${indicatorPaymentStatus}`);
      
      // Log the update
      await storage.logUserAction({
        userId: req.user!.id,
        action: "update_indicator_payment_status",
        entityType: "referral",
        entityId: referralId,
        oldValues: { indicatorPaymentStatus: existingReferral.indicatorPaymentStatus },
        newValues: { indicatorPaymentStatus },
        details: `Status de pagamento ao indicador da indicação ${referralId} alterado para ${paymentStatusLabels[indicatorPaymentStatus]}`
      });
      
      // Broadcast real-time update to all connected clients
      if ((app as any).broadcastUpdate) {
        (app as any).broadcastUpdate('referral_updated', result[0]);
      }
      
      return res.json(result[0]);
    } catch (error) {
      console.error("Error updating indicator payment status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status de pagamento" });
    }
  });

  // Bulk update referral company (admin only)
  app.patch("/api/referrals/bulk-company-update", requireAdmin, async (req, res) => {
    try {
      // Define validation schema for bulk update
      const bulkUpdateSchema = z.object({
        ids: z.array(z.number().int().positive()).min(1, "Selecione pelo menos uma indicação"),
        companyId: z.number().int().positive("ID da empresa inválido")
      });
      
      // Validate request body
      const validatedData = bulkUpdateSchema.parse(req.body);
      const { ids, companyId } = validatedData;
      
      console.log(`[BULK UPDATE] Admin ${req.user!.id} atualizando ${ids.length} indicações para empresa ${companyId}`);
      
      // Verify company exists
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }
      
      // Use transaction for all-or-nothing update
      const { inArray } = await import('drizzle-orm');
      const { referrals } = await import('@shared/schema.ts');
      
      const result = await db.transaction(async (tx) => {
        // Get all referrals to update for audit trail
        const referralsToUpdate = await tx.query.referrals.findMany({
          where: inArray(referrals.id, ids)
        });
        
        if (referralsToUpdate.length === 0) {
          throw new Error("Nenhuma indicação encontrada");
        }
        
        // Update all referrals
        const updated = await tx
          .update(referrals)
          .set({ 
            companyId,
            updatedAt: new Date()
          })
          .where(inArray(referrals.id, ids))
          .returning();
        
        // Add to status history for each referral
        for (const ref of referralsToUpdate) {
          const oldCompany = await storage.getCompanyById(ref.companyId);
          const statusHistoryEntry = {
            status: 'system',
            changedBy: req.user!.id,
            changedByName: req.user!.fullName || req.user!.username,
            changedAt: new Date().toISOString(),
            notes: `Seguradora alterada de "${oldCompany?.name || ref.companyId}" para "${company.name}" (Edição em massa)`
          };
          
          const newHistory = [...(ref.statusHistory || []), statusHistoryEntry];
          
          await tx
            .update(referrals)
            .set({ statusHistory: newHistory as any })
            .where(inArray(referrals.id, [ref.id]));
        }
        
        // Log audit trail
        await storage.logUserAction({
          userId: req.user!.id,
          action: "bulk_update_referral_company",
          entityType: "referral",
          entityId: undefined,
          details: `Atualização em massa: ${ids.length} indicações alteradas para empresa "${company.name}" (ID: ${companyId}). IDs: ${ids.join(', ')}`
        });
        
        return { count: updated.length };
      });
      
      console.log(`[BULK UPDATE] ${result.count} indicações atualizadas com sucesso`);
      
      return res.json({ 
        success: true,
        count: result.count,
        message: `${result.count} indicação(ões) atualizada(s) com sucesso` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: error.errors 
        });
      }
      console.error("Error in bulk update:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao atualizar indicações em massa" });
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

      // O status ia direto do body para o banco. Um valor digitado errado
      // gravava um estado inexistente e o saque ficava fora de qualquer filtro.
      const allowedStatuses: WithdrawalStatus[] = [
        "pending",
        "approved",
        "paid",
        "rejected",
        "retido",
      ];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Status inválido",
          details: `Valores aceitos: ${allowedStatuses.join(", ")}`,
        });
      }

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
          void sendWithdrawalNotification(
            user.phone,
            user.fullName,
            parseFloat(withdrawal.amount.toString()),
            status as 'approved' | 'rejected'
          ).catch((e) => console.log('SMS de saque falhou (non-critical):', e?.message ?? e));
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
      const userData = {
        ...req.body,
        createdBy: req.user!.id
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      // Send welcome SMS to new user if they have a phone
      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
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
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
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
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
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

  // Create new indicador (promotors can create with custom commission split)
  app.post("/api/promoter/indicators", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "promotor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Apenas promotores podem cadastrar indicadores" });
      }

      const { commissionValidated, commissionConverted, teamSupervisorId, ...rest } = req.body;

      // Validate commission values against pool limits
      const POOL_VALIDATED = 4;
      const POOL_CONVERTED = 60;
      // parseMoney barra NaN/Infinity/lixo; ver o comentário na definição.
      const validadoNum = commissionValidated !== undefined ? parseMoney(commissionValidated) : undefined;
      const convertidoNum = commissionConverted !== undefined ? parseMoney(commissionConverted) : undefined;

      if (validadoNum !== undefined && (validadoNum === null || validadoNum < 0 || validadoNum > POOL_VALIDATED)) {
        return res.status(400).json({ error: `Comissão validado deve estar entre R$0 e R$${POOL_VALIDATED}` });
      }
      if (convertidoNum !== undefined && (convertidoNum === null || convertidoNum < 0 || convertidoNum > POOL_CONVERTED)) {
        return res.status(400).json({ error: `Comissão convertido deve estar entre R$0 e R$${POOL_CONVERTED}` });
      }

      // If indicator is under a supervisor, validate against supervisor's allocation
      if (teamSupervisorId) {
        const supervisor = await storage.getUserById(parseInt(teamSupervisorId));
        if (!supervisor || supervisor.role !== 'supervisor') {
          return res.status(400).json({ error: "Supervisor inválido" });
        }
        const supAllocValidated = parseFloat(supervisor.commissionValidated?.toString() || '0');
        const supAllocConverted = parseFloat(supervisor.commissionConverted?.toString() || '0');
        if (validadoNum != null && validadoNum > supAllocValidated) {
          return res.status(400).json({ error: `Comissão validado do indicador (R$${commissionValidated}) não pode exceder a alocação do supervisor (R$${supAllocValidated})` });
        }
        if (convertidoNum != null && convertidoNum > supAllocConverted) {
          return res.status(400).json({ error: `Comissão convertido do indicador (R$${commissionConverted}) não pode exceder a alocação do supervisor (R$${supAllocConverted})` });
        }
      }

      const userData = {
        ...rest,
        // senha em texto puro: storage.createUser() aplica o hash
        role: "indicador",
        createdBy: req.user!.id,
        promoterId: req.user!.id,
        city: rest.city || "",
        state: rest.state || "",
        zipCode: rest.zipCode || "",
        ...(validadoNum != null && { commissionValidated: validadoNum.toFixed(2) }),
        ...(convertidoNum != null && { commissionConverted: convertidoNum.toFixed(2) }),
        ...(teamSupervisorId && { teamSupervisorId: parseInt(teamSupervisorId) }),
      };
      
      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
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

  // Create new supervisor (promotors only)
  app.post("/api/promoter/supervisors", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "promotor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Apenas promotores podem cadastrar supervisores" });
      }

      const POOL_VALIDATED = 4;
      const POOL_CONVERTED = 60;
      const { commissionValidated, commissionConverted, ...rest } = req.body;

      if (commissionValidated === undefined || commissionConverted === undefined) {
        return res.status(400).json({ error: "Defina os valores de comissão para o supervisor" });
      }
      const allocValidado = parseMoney(commissionValidated);
      const allocConvertido = parseMoney(commissionConverted);
      if (allocValidado === null || allocValidado < 0 || allocValidado > POOL_VALIDATED) {
        return res.status(400).json({ error: `Alocação validado deve estar entre R$0 e R$${POOL_VALIDATED}` });
      }
      if (allocConvertido === null || allocConvertido < 0 || allocConvertido > POOL_CONVERTED) {
        return res.status(400).json({ error: `Alocação convertido deve estar entre R$0 e R$${POOL_CONVERTED}` });
      }

      const userData = {
        ...rest,
        // senha em texto puro: storage.createUser() aplica o hash
        role: "supervisor",
        createdBy: req.user!.id,
        promoterId: req.user!.id,
        commissionValidated: allocValidado.toFixed(2),
        commissionConverted: allocConvertido.toFixed(2),
        city: rest.city || "",
        state: rest.state || "",
        zipCode: rest.zipCode || "",
      };

      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
        }
      }

      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating supervisor:", error);
      return res.status(500).json({ error: "Erro ao criar supervisor" });
    }
  });

  // Get all supervisors for a promotor
  app.get("/api/promoter/supervisors", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "promotor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const supervisors = await storage.getSupervisorsByPromoter(req.user!.id);
      return res.json(supervisors);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      return res.status(500).json({ error: "Erro ao buscar supervisores" });
    }
  });

  // Update commission values for a user (promotor can update supervisor/indicator commissions)
  app.patch("/api/promoter/users/:id/commissions", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "promotor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const userId = parseInt(req.params.id);
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ error: "Usuário não encontrado" });

      // Ensure target is under this promotor
      if (targetUser.promoterId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Você não tem permissão para editar este usuário" });
      }

      const { commissionValidated, commissionConverted } = req.body;
      const POOL_VALIDATED = 4;
      const POOL_CONVERTED = 60;

      if (commissionValidated !== undefined) {
        const val = parseMoney(commissionValidated);
        if (val === null || val < 0 || val > POOL_VALIDATED) {
          return res.status(400).json({ error: `Valor deve estar entre R$0 e R$${POOL_VALIDATED}` });
        }
        // If updating a supervisor's allocation, ensure existing indicadores under them don't exceed it
        if (targetUser.role === 'supervisor') {
          const indicadoresUnderSup = await storage.getIndicadoresBySupervisor(userId);
          for (const ind of indicadoresUnderSup) {
            const indVal = parseFloat(ind.commissionValidated?.toString() || '0');
            if (indVal > val) {
              return res.status(400).json({ error: `A nova alocação (R$${val}) é menor que a comissão de um indicador vinculado (R$${indVal}). Ajuste o indicador primeiro.` });
            }
          }
        }
        // If updating an indicador under a supervisor, check supervisor allocation
        if (targetUser.role === 'indicador' && targetUser.teamSupervisorId) {
          const sup = await storage.getUserById(targetUser.teamSupervisorId);
          const supAlloc = parseFloat(sup?.commissionValidated?.toString() || '0');
          if (val > supAlloc) {
            return res.status(400).json({ error: `Comissão não pode exceder alocação do supervisor (R$${supAlloc})` });
          }
        }
      }
      if (commissionConverted !== undefined) {
        const val = parseMoney(commissionConverted);
        if (val === null || val < 0 || val > POOL_CONVERTED) {
          return res.status(400).json({ error: `Valor deve estar entre R$0 e R$${POOL_CONVERTED}` });
        }
        if (targetUser.role === 'supervisor') {
          const indicadoresUnderSup = await storage.getIndicadoresBySupervisor(userId);
          for (const ind of indicadoresUnderSup) {
            const indVal = parseFloat(ind.commissionConverted?.toString() || '0');
            if (indVal > val) {
              return res.status(400).json({ error: `A nova alocação (R$${val}) é menor que a comissão de um indicador vinculado (R$${indVal}). Ajuste o indicador primeiro.` });
            }
          }
        }
        if (targetUser.role === 'indicador' && targetUser.teamSupervisorId) {
          const sup = await storage.getUserById(targetUser.teamSupervisorId);
          const supAlloc = parseFloat(sup?.commissionConverted?.toString() || '0');
          if (val > supAlloc) {
            return res.status(400).json({ error: `Comissão não pode exceder alocação do supervisor (R$${supAlloc})` });
          }
        }
      }

      const updates: any = {};
      // val/valConv já validados acima com parseMoney
      if (commissionValidated !== undefined) {
        const n = parseMoney(commissionValidated);
        if (n === null) return res.status(400).json({ error: "Comissão validado inválida" });
        updates.commissionValidated = n.toFixed(2);
      }
      if (commissionConverted !== undefined) {
        const n = parseMoney(commissionConverted);
        if (n === null) return res.status(400).json({ error: "Comissão convertido inválida" });
        updates.commissionConverted = n.toFixed(2);
      }

      const updatedUser = await storage.updateUserProfile(userId, updates);
      const { password, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating commissions:", error);
      return res.status(500).json({ error: "Erro ao atualizar comissões" });
    }
  });

  // === SUPERVISOR ROUTES ===

  // Supervisor: get their team (indicadores)
  app.get("/api/supervisor/team", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "supervisor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const indicadores = await storage.getIndicadoresBySupervisor(req.user!.id);
      return res.json(indicadores.map(u => {
        const { password, ...rest } = u;
        return rest;
      }));
    } catch (error) {
      console.error("Error fetching supervisor team:", error);
      return res.status(500).json({ error: "Erro ao buscar equipe" });
    }
  });

  // Supervisor: create indicador
  app.post("/api/supervisor/indicators", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "supervisor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Apenas supervisores podem usar esta rota" });
      }

      const supervisor = await storage.getUserById(req.user!.id);
      if (!supervisor) return res.status(404).json({ error: "Supervisor não encontrado" });

      const supAllocValidated = parseFloat(supervisor.commissionValidated?.toString() || '0');
      const supAllocConverted = parseFloat(supervisor.commissionConverted?.toString() || '0');

      const { commissionValidated, commissionConverted, ...rest } = req.body;

      if (commissionValidated === undefined || commissionConverted === undefined) {
        return res.status(400).json({ error: "Defina os valores de comissão para o indicador" });
      }
      const indValidado = parseMoney(commissionValidated);
      const indConvertido = parseMoney(commissionConverted);
      if (indValidado === null || indValidado < 0 || indValidado > supAllocValidated) {
        return res.status(400).json({ error: `Comissão validado deve estar entre R$0 e R$${supAllocValidated} (sua alocação)` });
      }
      if (indConvertido === null || indConvertido < 0 || indConvertido > supAllocConverted) {
        return res.status(400).json({ error: `Comissão convertido deve estar entre R$0 e R$${supAllocConverted} (sua alocação)` });
      }

      const userData = {
        ...rest,
        // senha em texto puro: storage.createUser() aplica o hash
        role: "indicador",
        createdBy: req.user!.id,
        promoterId: supervisor.promoterId, // Link to the root promotor
        teamSupervisorId: req.user!.id,
        city: rest.city || "",
        state: rest.state || "",
        zipCode: rest.zipCode || "",
        commissionValidated: indValidado.toFixed(2),
        commissionConverted: indConvertido.toFixed(2),
      };

      const newUser = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = newUser;

      if (newUser.phone) {
        try {
          const { sendWelcomeSMS } = await import('./sms-service');
          // Sem await: SMS é notificação, não pode atrasar nem derrubar o cadastro
          void sendWelcomeSMS(newUser.phone, newUser.fullName).catch((e) =>
            console.log('Welcome SMS failed (non-critical):', e?.message ?? e));
        } catch (smsError) {
          console.log('Welcome SMS failed (non-critical):', smsError);
        }
      }

      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating indicador by supervisor:", error);
      return res.status(500).json({ error: "Erro ao criar indicador" });
    }
  });

  // Supervisor: get their referrals
  app.get("/api/supervisor/referrals", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "supervisor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const indicadores = await storage.getIndicadoresBySupervisor(req.user!.id);
      const indicadorIds = indicadores.map(i => i.id);
      if (indicadorIds.length === 0) return res.json([]);
      const allReferrals = await storage.getAllReferrals();
      const teamReferrals = allReferrals.filter((r: any) => indicadorIds.includes(r.userId));
      return res.json(teamReferrals);
    } catch (error) {
      console.error("Error fetching supervisor referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Supervisor: get their own info (allocation from promotor)
  app.get("/api/supervisor/info", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "supervisor" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const supervisor = await storage.getUserById(req.user!.id);
      if (!supervisor) return res.status(404).json({ error: "Não encontrado" });
      const { password, ...rest } = supervisor;
      return res.json(rest);
    } catch (error) {
      console.error("Error fetching supervisor info:", error);
      return res.status(500).json({ error: "Erro ao buscar informações" });
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
      
      // Não logar req.body: ele contém a senha mestre em texto puro
      // (mascarar só o campo `masterPassword` não adiantava nada).
      console.log('Delete user request:', { id });

      // Validate master password
      const DEVELOPER_MASTER_PASSWORD = process.env.DEVELOPER_MASTER_PASSWORD;
      if (!masterPassword || typeof masterPassword !== "string") {
        return res.status(400).json({ error: "Senha mestre é obrigatória" });
      }

      if (!DEVELOPER_MASTER_PASSWORD) {
        console.error("DEVELOPER_MASTER_PASSWORD environment variable not set");
        return res.status(500).json({ error: "Configuração do servidor incompleta" });
      }

      if (!safeCompare(masterPassword, DEVELOPER_MASTER_PASSWORD)) {
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

  /**
   * REMOVIDO: havia aqui um segundo `app.post("/api/register")` que repassava
   * `req.body` cru para storage.createUser — ou seja, cadastro com role,
   * permissions e comissões escolhidos pelo cliente.
   *
   * Ele nunca chegou a executar porque setupAuth(app) na linha 55 registra
   * /api/register antes, e o Express atende pela primeira rota registrada.
   * Era uma mina: bastava alguém reordenar as chamadas para abrir a escalação
   * de privilégio. O cadastro válido vive em server/auth.ts.
   */

  // Registration with referral link
  app.post("/api/register-with-referral", async (req, res) => {
    try {
      const { referralToken } = req.body;

      /**
       * ESTE ENDPOINT ERA A PIOR BRECHA DO SISTEMA.
       *
       * Ele repassava `req.body.userData` CRU para createUserWithReferralAttribution,
       * que honra role, permissions, analystLevel e as comissões. Qualquer pessoa
       * na internet, sem autenticação, criava uma conta `role: "admin"` com as
       * permissões que quisesse e commissionValidated de R$9999,99.
       *
       * Agora passa pelo mesmo allowlist do cadastro normal (insertUserSchema)
       * e o papel é fixado no servidor. A atribuição de promotor/supervisor vem
       * do TOKEN do link, nunca do corpo da requisição.
       */
      const parsed = insertUserSchema.safeParse(req.body.userData);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }

      const token =
        typeof referralToken === "string" && referralToken.trim()
          ? referralToken.trim()
          : undefined;

      const newUser = await storage.createUserWithReferralAttribution(
        { ...parsed.data, role: "indicador", createdBy: undefined },
        token,
      );

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

  /**
   * WebSocket de atualizações em tempo real.
   *
   * Antes: `new WebSocketServer({ server, path: '/ws' })` aceitava QUALQUER
   * conexão, sem autenticação, e o broadcast enviava o objeto completo da
   * indicação — nome, telefone, placa e o comprovante de pagamento em base64 —
   * para todos os conectados. Bastava abrir um WebSocket para o endereço e
   * ficar recebendo dado pessoal de todo mundo em tempo real.
   *
   * Agora o handshake exige sessão válida (mesmo cookie do Express) e o
   * broadcast carrega só o identificador do que mudou; o cliente refaz o fetch
   * autenticado, respeitando as permissões dele.
   */
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/ws')) return; // deixa o Vite HMR e outros seguirem

    const recusar = (motivo: string) => {
      console.warn(`[WebSocket] Handshake recusado: ${motivo}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    };

    if (!sessionMiddleware) return recusar('sessão não inicializada');

    // Roda o middleware de sessão sobre a requisição de upgrade para
    // materializar req.session a partir do cookie.
    sessionMiddleware(req as any, {} as any, () => {
      const sessao = (req as any).session;
      const userId = sessao?.passport?.user;

      if (!userId) return recusar('sem sessão autenticada');

      wss.handleUpgrade(req, socket, head, (ws) => {
        (ws as any).userId = userId;
        wss.emit('connection', ws, req);
      });
    });
  });

  // Store connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log(`[WebSocket] Cliente conectado (userId=${(ws as any).userId})`);
    clients.add(ws);

    // Detecta conexões mortas: sem isso, sockets de celular que perderam sinal
    // ficam acumulando no Set e o broadcast tenta escrever neles para sempre.
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
      clients.delete(ws);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if ((client as any).isAlive === false) {
        clients.delete(client);
        client.terminate();
        continue;
      }
      (client as any).isAlive = false;
      client.ping();
    }
  }, 30_000);
  heartbeat.unref?.();

  /**
   * Envia apenas o necessário para o cliente saber O QUE mudou.
   * O conteúdo em si ele busca por HTTP autenticado.
   */
  const broadcastUpdate = (type: string, data: any) => {
    const resumo = data && typeof data === 'object'
      ? { id: data.id, status: data.status, updatedAt: data.updatedAt }
      : data;

    const message = JSON.stringify({ type, data: resumo, timestamp: new Date().toISOString() });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    console.log(`[WebSocket] Broadcasted ${type} to ${clients.size} clients`);
  };
  
  // Make broadcast function available globally for use in routes
  (app as any).broadcastUpdate = broadcastUpdate;

  return server;
}