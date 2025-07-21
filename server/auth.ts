import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { insertUserSchema, loginSchema } from "@shared/schema";
import { storage } from "./storage";
import type { Express } from "express";

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

export function setupAuth(app: Express) {
  // Session configuration
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        
        // Check if user is active
        if (!user.isActive) {
          return done(new AuthError("Usuário desativado", 403), false);
        }
        
        return done(null, user);
      } catch (err) {
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
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }
      
      // Check if CPF already exists
      const existingCpf = await storage.getUserByCpf(userData.cpf);
      if (existingCpf) {
        return res.status(400).json({ message: "Este CPF já está cadastrado" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword,
        role: "indicador", // Default role for new registrations
        createdBy: null // Self-registration
      });
      
      // Log the user in
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        
        const { password, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
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
      
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          console.error("Login error:", err);
          
          if (err instanceof AuthError) {
            return res.status(err.statusCode).json({ message: err.message });
          }
          
          return res.status(500).json({ message: "Erro no servidor" });
        }

        if (!user) {
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("Session error:", err);
            return res.status(500).json({ message: "Erro ao iniciar sessão" });
          }

          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ message: "Erro no servidor" });
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

// Type declarations for Express
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      fullName: string;
      role: string;
      isActive: boolean;
      balance: string;
      totalEarnings: string;
    }
  }
}