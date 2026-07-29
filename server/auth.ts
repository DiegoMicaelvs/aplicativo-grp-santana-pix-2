import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { insertUserSchema, loginSchema, type User as DbUser } from "@shared/schema";
import { storage } from "./storage";
import type { Express } from "express";
import { validateUserDuplicates } from "./crossAppValidation";

const scryptAsync = promisify(scrypt);
const crypto = { scrypt: scryptAsync, randomBytes, timingSafeEqual };

// Custom error class for authentication
class AuthError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Password hashing functions
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const buf = await crypto.scrypt(password, salt, 64) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  } catch (error) {
    throw new AuthError("Erro ao processar senha");
  }
}

export async function comparePasswords(
  suppliedPassword: string,
  storedPassword: string
): Promise<boolean> {
  try {
    const [hashedPassword, salt] = storedPassword.split(".");
    if (!hashedPassword || !salt) {
      return false;
    }
    
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = await crypto.scrypt(suppliedPassword, salt, 64) as Buffer;
    return crypto.timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  } catch (error) {
    return false;
  }
}

/**
 * O mesmo middleware de sessão usado no Express, exposto para que o handshake
 * do WebSocket possa autenticar a conexão a partir do cookie metis.sid.
 * Preenchido por setupAuth().
 */
export let sessionMiddleware: ReturnType<typeof session> | null = null;

export function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  /**
   * O segredo de sessão precisa ser estável e explícito.
   * O fallback aleatório anterior parecia inofensivo mas: invalidava todas as
   * sessões a cada restart e, com mais de uma instância, cada uma assinava com
   * um segredo diferente — o usuário caía deslogado a cada requisição.
   * Em produção isso agora é erro de inicialização, não um comportamento
   * silenciosamente quebrado.
   */
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && isProduction) {
    throw new Error(
      "SESSION_SECRET é obrigatório em produção. Gere um valor com: " +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
  if (!sessionSecret) {
    console.warn(
      "[AUTH] SESSION_SECRET não definido — usando segredo efêmero de desenvolvimento. " +
        "As sessões serão perdidas a cada restart.",
    );
  }

  /**
   * `secure` marca o cookie como exclusivo de HTTPS. Estava fixo em `false`,
   * o que exporia o cookie de sessão em texto claro em produção.
   * Use COOKIE_SECURE=false apenas se realmente servir produção sob HTTP.
   */
  const secureCookie = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : isProduction;

  console.log(
    `[AUTH] Configurando autenticação - NODE_ENV=${process.env.NODE_ENV ?? "development"}, secureCookie=${secureCookie}`,
  );

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'metis.sid', // Nome consistente da sessão
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/", // Cookie válido em todo o site
      domain: undefined // Deixar o navegador gerenciar o domínio automaticamente
    }
  };

  // `trust proxy` é configurado centralmente em server/index.ts
  // (configureTrustProxy), a partir de TRUST_PROXY.
  sessionMiddleware = session(sessionSettings);
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport strategy with enhanced debugging
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Normalizar username
        const normalizedUsername = username.trim().toLowerCase();
        console.log(`[AUTH] Tentativa de login: ${normalizedUsername}`);
        
        const user = await storage.getUserByUsername(normalizedUsername);
        
        if (!user) {
          console.log(`[AUTH] Usuário não encontrado: ${normalizedUsername}`);
          return done(null, false);
        }
        
        // Check if user is active BEFORE password check
        if (!user.isActive) {
          console.log(`[AUTH] Usuário desativado: ${normalizedUsername}`);
          return done(new AuthError("Usuário desativado", 403), false);
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        
        if (!passwordMatch) {
          console.log(`[AUTH] Senha incorreta para usuário: ${normalizedUsername}`);
          return done(null, false);
        }
        
        console.log(`[AUTH] Login bem-sucedido: ${normalizedUsername}`);
        return done(null, user);
      } catch (err) {
        console.error(`[AUTH] LocalStrategy - Erro na autenticação para ${username}:`, err);
        return done(err);
      }
    }),
  );

  // Serialize/deserialize user
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error('Error deserializing user:', err);
      done(null, false);
    }
  });

  // Register route
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate the request data
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        // Log para auditoria de tentativas de registro duplicado
        console.log(`[REGISTRO] Tentativa de cadastro duplicado - Email já existe: ${userData.username}`);
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }
      
      // Check if CPF already exists
      const existingCpf = await storage.getUserByCpf(userData.cpf);
      if (existingCpf) {
        console.log(`[REGISTRO] Tentativa de cadastro duplicado - CPF já existe: ${userData.cpf}`);
        return res.status(400).json({ message: "Este CPF já está cadastrado" });
      }

      // Check for duplicates in other apps (cross-app validation)
      const crossAppValidation = await validateUserDuplicates({
        cpf: userData.cpf,
        phone: userData.phone,
        email: userData.username
      });
      
      if (crossAppValidation.isDuplicate) {
        const validationError = crossAppValidation.message || 
          "Este usuário já está cadastrado em outro aplicativo";
        
        console.log(`[REGISTRO] Cadastro duplicado em outro app - ${userData.cpf}: ${validationError}`);
        return res.status(400).json({ 
          message: validationError,
          crossAppDuplicate: true
        });
      }
      
      // NÃO hashear aqui: storage.createUser() já faz o hash.
      // Hashear nos dois lugares gera hash(hash(senha)) e o login passa a falhar sempre.
      const newUser = await storage.createUser({
        ...userData,
        role: "indicador", // Default role for new registrations
        createdBy: undefined, // Self-registration
      });
      
      console.log(`[REGISTRO] Novo usuário cadastrado com sucesso: ${newUser.username} (ID: ${newUser.id})`);
      
      // Log the user in
      req.login(newUser, (err) => {
        if (err) {
          console.error("[REGISTRO] Erro ao fazer login automático:", err);
          return next(err);
        }
        
        const { password, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error(`[REGISTRO] Erro ao processar cadastro:`, error.message);
      
      if (error.name === 'ZodError') {
        console.error(`[REGISTRO] Dados inválidos:`, error.errors);
        const friendlyErrors = error.errors.map((err: any) => {
          const field = err.path.join('.');
          switch (field) {
            case 'fullName':
              return 'Nome completo é obrigatório';
            case 'username':
              return 'Email inválido ou não informado';
            case 'email':
              return 'Email é obrigatório e deve ser válido';
            case 'password':
              return 'Senha deve ter pelo menos 6 caracteres';
            case 'cpf':
              return 'CPF inválido';
            case 'phone':
              return 'Telefone inválido';
            case 'pixKey':
              return 'Chave PIX é obrigatória';
            default:
              return err.message;
          }
        });
        return res.status(400).json({ 
          message: "Por favor, corrija os seguintes erros: " + friendlyErrors.join(', ')
        });
      }
      
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    try {
      // Validate login data
      const loginData = loginSchema.parse(req.body);
      console.log(`[AUTH] Login attempt: ${loginData.username}`);
      
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          console.error(`[AUTH] Authentication error for ${loginData.username}:`, err);
          
          if (err instanceof AuthError) {
            return res.status(err.statusCode).json({ message: err.message });
          }
          
          return res.status(500).json({ message: "Erro no servidor" });
        }

        if (!user) {
          console.log(`[AUTH] Authentication failed for ${loginData.username} - No user returned`);
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        console.log(`[AUTH] User authenticated successfully: ${user.username} (ID: ${user.id})`);

        req.login(user, (err) => {
          if (err) {
            console.error(`[AUTH] Session creation error for ${user.username}:`, err);
            return res.status(500).json({ message: "Erro ao iniciar sessão" });
          }

          // Não logar req.sessionID: o ID de sessão é credencial — quem lê o log
          // consegue sequestrar a sessão.
          console.log(`[AUTH] Session created successfully for ${user.username}`);
          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (error: any) {
      console.error(`[AUTH] Login route error:`, error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ message: "Erro no servidor" });
    }
  });

  // Change password route
  app.post("/api/change-password", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    next();
  }, async (req: any, res: any) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;
      
      // Get user from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Verify current password
      const isValidPassword = await comparePasswords(currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: "Senha atual incorreta" });
      }
      
      // Hash new password and update
      const hashedNewPassword = await hashPassword(newPassword);
      await storage.updateUserProfile(userId, { 
        password: hashedNewPassword,
        mustChangePassword: false // Remove the flag after password change
      });
      
      return res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({ error: "Erro ao alterar senha" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(400).json({ message: "Não está autenticado" });
    }

    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Erro ao sair" });
      }
      
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Check authentication status
  app.get("/api/auth/status", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const { password, ...userWithoutPassword } = req.user as any;
      res.json({ authenticated: true, user: userWithoutPassword });
    } else {
      res.json({ authenticated: false });
    }
  });


}

/**
 * `deserializeUser` coloca o registro COMPLETO do banco em `req.user`.
 * Esta declaração era um subconjunto mantido à mão e já tinha divergido do
 * schema (faltavam promoterId, supervisorId, analystId, teamSupervisorId,
 * permissions...), o que escondia campos reais e tipava `role` como `string`.
 * Derivar do tipo do schema mantém os dois lados sempre em sincronia.
 */
declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}