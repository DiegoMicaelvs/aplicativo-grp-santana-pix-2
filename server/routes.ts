import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { updateReferralStatusSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { referrals } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // API routes
  
  // Get current user's referrals
  app.get("/api/referrals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    try {
      const userReferrals = await storage.getReferralsByUserId(req.user.id);
      return res.json(userReferrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Create a new referral
  app.post("/api/referrals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    try {
      const referral = await storage.createReferral({
        ...req.body,
        userId: req.user.id
      });
      return res.status(201).json(referral);
    } catch (error) {
      console.error("Error creating referral:", error);
      return res.status(500).json({ error: "Erro ao criar indicação" });
    }
  });

  // Admin routes - for managing referrals
  app.get("/api/admin/referrals", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    try {
      const allReferrals = await storage.getAllReferrals();
      return res.json(allReferrals);
    } catch (error) {
      console.error("Error fetching all referrals:", error);
      return res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  // Update referral status
  app.patch("/api/admin/referrals/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { id } = req.params;
    
    try {
      const validatedData = updateReferralStatusSchema.parse(req.body);
      
      // Update the referral
      const updatedReferral = await storage.updateReferralStatus(
        parseInt(id), 
        validatedData.status, 
        validatedData.commission,
        validatedData.notes,
        validatedData.paidAt
      );
      
      return res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral:", error);
      return res.status(500).json({ error: "Erro ao atualizar status da indicação" });
    }
  });

  // Check for duplicate referrals
  app.post("/api/referrals/check-duplicate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const { phone, licensePlate } = req.body;
      
      if (!phone && !licensePlate) {
        return res.status(400).json({ error: "Telefone ou placa deve ser fornecido" });
      }

      const duplicates = await storage.checkDuplicateReferral(phone, licensePlate);
      
      if (duplicates.length > 0) {
        return res.json({ 
          isDuplicate: true, 
          existingReferrals: duplicates 
        });
      }

      return res.json({ isDuplicate: false });
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return res.status(500).json({ error: "Erro ao verificar duplicatas" });
    }
  });

  // Get all users for admin
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    try {
      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Create the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
