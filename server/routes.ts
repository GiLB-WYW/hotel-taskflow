import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertTaskSchema,
  insertLocationSchema,
  insertMaintenanceGroupSchema,
  insertCategorySchema,
  insertActivityLogSchema,
  insertProjectSchema,
  insertProjectPlanSchema,
  insertTradeSchema,
  insertProjectTaskSchema,
  insertQuoteSchema,
} from "@shared/schema";
import { z } from "zod";
import { sendInvitationEmail } from "./email";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { preparationScope2026 } from "./preparationScope";

async function ensureSmtrGroup() {
  try {
    const groups = await storage.listMaintenanceGroups();
    const smtrExists = groups.some(g => g.name === "SMTR team");
    if (!smtrExists) {
      await storage.createMaintenanceGroup({ name: "SMTR team", memberCount: 0 });
      console.log("SMTR team group created automatically.");
    }
  } catch (error) {
    console.error("Failed to ensure SMTR group:", error);
  }
}

async function ensureDefaultTrades() {
  try {
    const existing = await storage.listTrades();
    const names = ["Electrical", "Plumbing", "Climate Control", "General Works", "Landscaping", "Kitchen Equipment", "Pool", "Painting"];
    const existingNames = new Set(existing.map(trade => trade.name.trim().toLowerCase()));

    for (const name of names) {
      if (!existingNames.has(name.toLowerCase())) {
        await storage.createTrade({ name });
      }
    }
  } catch (error) {
    console.error("Failed to ensure default preparation trades:", error);
  }
}

async function ensureInitialAdmin() {
  const users = await storage.listUsers();
  if (users.some(user => user.role === "Admin")) {
    return;
  }

  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    const message = "No administrator exists. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD as deployment secrets to provision an administrator.";
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(message);
    return;
  }

  const admin = await storage.createInitialAdmin({
    name: process.env.INITIAL_ADMIN_NAME || "Administrator",
    email,
    password,
    role: "Admin",
  });
  if (admin) {
    console.log("Initial administrator provisioned from deployment secrets.");
  }
}

function hasPreparationAccess(role: string | null | undefined) {
  return role === "Admin" || role === "Coordinator";
}

function hasTaskManagementAccess(role: string | null | undefined) {
  return hasPreparationAccess(role) || role === "Manager";
}

function canReadTask(
  user: { id: string; role: string; group?: string | null; groups?: string[] | null },
  task: {
    assignedTo: string | null;
    assignedGroup: string | null;
    assignedGroups: string[] | null;
    createdBy: string;
  },
) {
  if (hasPreparationAccess(user.role)) {
    return true;
  }

  if (task.createdBy === user.id || task.assignedTo === user.id) {
    return true;
  }

  if (user.role !== "Manager") {
    return false;
  }

  const userGroups = [user.group, ...(user.groups || [])].filter(
    (group): group is string => Boolean(group),
  );
  const taskGroups = [task.assignedGroup, ...(task.assignedGroups || [])].filter(
    (group): group is string => Boolean(group),
  );
  return userGroups.some(group => taskGroups.includes(group));
}

async function getSessionUser(req: Request) {
  if (!req.session.userId) {
    return null;
  }
  return storage.getUser(req.session.userId);
}

async function requirePreparationAccess(req: Request, res: Response) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in to access project preparations." });
    return null;
  }

  if (!hasPreparationAccess(user.role)) {
    res.status(403).json({ error: "Project preparations are restricted to Admins and Coordinators." });
    return null;
  }

  return user;
}

async function requireAdminAccess(req: Request, res: Response) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "Admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return null;
  }
  return user;
}

async function requireTaskManagementAccess(req: Request, res: Response) {
  const user = await getSessionUser(req);
  if (!user || !hasTaskManagementAccess(user.role)) {
    res.status(403).json({ error: "Administrator, Coordinator, or Manager access is required to manage tasks." });
    return null;
  }
  return user;
}

function normalizeCurrencyFields<T extends Record<string, unknown>>(data: T, fields: string[]): T {
  const normalized: Record<string, unknown> = { ...data };
  for (const field of fields) {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== "") {
      normalized[field] = String(normalized[field]);
    }
  }
  return normalized as T;
}

function hasValidNonNegativeCurrency(data: Record<string, unknown>, fields: string[]) {
  return fields.every(field => {
    const value = data[field];
    return value === undefined || value === null || value === "" ||
      (Number.isFinite(Number(value)) && Number(value) >= 0);
  });
}

function classifyMaintenanceTask(groupName?: string | null, title?: string | null) {
  const value = `${groupName || ""} ${title || ""}`.toLowerCase();
  if (/(electric|électric|luminaire|lumière|borne|éclairage|radiateur)/.test(value)) {
    return { category: "Electrical", tradeName: "Electrical" };
  }
  if (/(plomb|eau|évacuation|adoucisseur|toilette|chaudière)/.test(value)) {
    return { category: "Plumbing", tradeName: "Plumbing" };
  }
  if (/(clim|chauffage|vmc|ventilat|aération)/.test(value)) {
    return { category: "Climate Control", tradeName: "Climate Control" };
  }
  if (/(piscine|pool)/.test(value)) {
    return { category: "Pool", tradeName: "Pool" };
  }
  if (/(peint|façade|enduir)/.test(value)) {
    return { category: "Finishes", tradeName: "Painting" };
  }
  if (/(paysage|parking|jardin|extérieur|terrasse)/.test(value)) {
    return { category: "Landscaping", tradeName: "Landscaping" };
  }
  if (/(cuisine|inox|plancha|bar)/.test(value)) {
    return { category: "Kitchen Equipment", tradeName: "Kitchen Equipment" };
  }
  return { category: "General Works", tradeName: "General Works" };
}

function normalizedText(value?: string | null) {
  return (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function scopeMatchesLocation(scopeBuilding: string, location: { name: string; category: string; code?: string | null }) {
  const building = normalizedText(scopeBuilding);
  const locationText = normalizedText(`${location.name} ${location.category} ${location.code || ""}`);
  if (building === "paysage") return /(jardin|exterieur|terrasse|parking)/.test(locationText);
  // "Retard de paiement" items are cross-property payment delay invoices — never auto-match a location
  if (building === "retarddepaiement") return false;
  // La Guinguette is a bar/restaurant space — does NOT match pool (piscine) locations
  if (building === "laguinguette") return /(guinguette|bar|restaurant)/.test(locationText);
  return locationText.includes(building);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app, async (req) => {
    const user = await getSessionUser(req);
    return hasPreparationAccess(user?.role);
  }, async (req) => {
    return !!await getSessionUser(req);
  });

  const publicApiPaths = new Set([
    "/auth/login",
    "/auth/logout",
    "/auth/validate-session",
    "/auth/email-login",
    "/auth/oauth",
    "/auth/google/config",
    "/auth/reset-password",
  ]);
  app.use("/api", async (req, res, next) => {
    const isPublicInvitationLookup =
      req.method === "GET" && /^\/invitations\/[a-f0-9]{64}$/i.test(req.path);
    if (
      publicApiPaths.has(req.path) ||
      isPublicInvitationLookup ||
      (req.method === "POST" && req.path === "/invitations/accept")
    ) {
      return next();
    }

    try {
      const user = await getSessionUser(req);
      if (!user) {
        return res.status(401).json({ error: "Please sign in to access this resource." });
      }
      res.locals.authUser = user;
      return next();
    } catch (error) {
      console.error("Session authorization error:", error);
      return res.status(500).json({ error: "Unable to verify your session." });
    }
  });

  // Ensure SMTR team group exists in the database
  await ensureSmtrGroup();
  await ensureInitialAdmin();
  await ensureDefaultTrades();
  
  // Debug endpoint to test task serialization
  app.get("/api/debug/tasks-sample", async (req, res) => {
    try {
      const allTasks = await storage.listTasks({});
      // Return just first 3 tasks for testing
      const sample = allTasks.slice(0, 3);
      console.log("Sample tasks:", sample.length);
      res.json({
        totalCount: allTasks.length,
        sampleCount: sample.length,
        sample: sample
      });
    } catch (error) {
      console.error("Debug tasks-sample error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to check database connection and data in production
  app.get("/api/debug/status", async (req, res) => {
    try {
      const tasks = await storage.listTasks({});
      const users = await storage.listUsers();
      const locations = await storage.listLocations();

      res.json({
        status: "connected",
        environment: process.env.NODE_ENV || "unknown",
        timestamp: new Date().toISOString(),
        counts: {
          tasks: tasks.length,
          users: users.length,
          locations: locations.length
        },
        databaseUrl: process.env.DATABASE_URL ? "configured" : "missing"
      });
    } catch (error) {
      console.error("Debug status error:", error);
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        databaseUrl: process.env.DATABASE_URL ? "configured" : "missing"
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const actor = await getSessionUser(req);
      if (actor?.role !== "Admin") {
        return res.status(403).json({ error: "Administrator access is required to create users." });
      }
      const data = insertUserSchema.parse(req.body);
      if (!data.password) {
        return res.status(400).json({ error: "Password required" });
      }
      const existingUser = await storage.getUserByEmail(data.email);

      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      const user = await storage.createUser(data);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      console.log("Login attempt for:", email);
      
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("User not found:", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      console.log("User found:", user.email, "Has password:", !!user.password);

      if (!user.password) {
        return res.status(403).json({ error: "This account has not completed password setup. Please contact an administrator." });
      }
      if (!password) {
        return res.status(400).json({ error: "Password required" });
      }

      console.log("Verifying password for user:", user.id);
      const isValid = await storage.verifyPassword(user.id, password);
      console.log("Password valid:", isValid);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Don't send password hash to client
      const { password: _, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      console.log("Login successful for:", email);
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Session validation endpoint - verifies if stored session corresponds to real user
  app.post("/api/auth/validate-session", async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) {
        return res.json({ valid: false, error: "No authenticated session" });
      }

      // Return fresh user data (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.json({ valid: true, user: userWithoutPassword });
    } catch (error) {
      console.error("Session validation error:", error);
      res.json({ valid: false, error: "Validation failed" });
    }
  });

  app.get("/api/auth/google/config", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    res.json({
      enabled: Boolean(clientId),
      clientId: clientId || null,
    });
  });

  // Do not treat an arbitrary email address as an authenticated identity.
  app.post("/api/auth/email-login", async (req, res) => {
    res.status(410).json({ error: "Password sign-in is required. Complete an invitation or use your account password." });
  });

  app.post("/api/auth/oauth", async (req, res) => {
    try {
      const { authProvider, credential } = req.body;
      if (authProvider !== "google" || typeof credential !== "string" || !credential) {
        return res.status(400).json({ error: "A verified Google sign-in credential is required." });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ error: "Google sign-in is not configured yet." });
      }

      const googleClient = new OAuth2Client(clientId);
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      const email = payload?.email?.trim().toLowerCase();
      const authId = payload?.sub;

      if (!email || !authId || payload?.email_verified !== true) {
        return res.status(401).json({ error: "Google did not provide a verified email address." });
      }

      let user = await storage.getUserByAuthId("google", authId);
      if (!user) {
        user = await storage.getUserByEmail(email);
      }

      if (!user) {
        return res.status(403).json({
          error: "This Google account is not registered. Please ask an administrator for an invitation first.",
        });
      }

      user = await storage.updateUser(user.id, {
        authProvider: "google",
        authId,
        avatar: payload.picture || user.avatar || null,
      });

      req.session.userId = user.id;
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Google OAuth verification error:", error);
      res.status(401).json({ error: "Google sign-in could not be verified." });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const users = await storage.listUsers();
      // Add hasPassword field to indicate if account is activated
      const usersWithStatus = users.map(user => ({
        ...user,
        hasPassword: !!user.password,
        password: undefined, // Never expose password hash
      }));
      res.json(usersWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const { name, email, role, password, groups, group } = req.body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;
      if (groups !== undefined) updates.groups = groups;
      // Handle single group assignment (legacy support)
      if (group !== undefined) updates.group = group;
      
      const user = await storage.updateUser(req.params.id, updates);
      
      if (password) {
        await storage.updatePassword(req.params.id, password);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Change password for logged-in users
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      const actor = await getSessionUser(req);
      
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "User ID and new password required" });
      }
      if (!actor || actor.id !== userId) {
        return res.status(403).json({ error: "You may only change your own password from an authenticated session." });
      }
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValid = await storage.verifyPassword(userId, currentPassword);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      await storage.updatePassword(userId, newPassword);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Update user profile (for logged-in user to update their own info)
  app.patch("/api/profile", async (req, res) => {
    try {
      const { userId, name, email } = req.body;
      const actor = await getSessionUser(req);
      
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      if (!actor || actor.id !== userId) {
        return res.status(403).json({ error: "You may only update your own profile from an authenticated session." });
      }

      if ((!name || name.trim().length === 0) && (!email || email.trim().length === 0)) {
        return res.status(400).json({ error: "Name or email is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updates: { name?: string; email?: string } = {};
      if (name) updates.name = name.trim();
      if (email) updates.email = email.trim();
      const updatedUser = await storage.updateUser(userId, updates);
      // Don't send password hash to client
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Invitation routes
  app.post("/api/invitations", async (req, res) => {
    try {
      const actor = await requireAdminAccess(req, res);
      if (!actor) return;
      const { email, name, role } = req.body;

      if (!email || !name || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "A user with this email already exists" });
      }

      // Check for pending invitation
      const existingInvite = await storage.getInvitationByEmail(email);
      if (existingInvite && !existingInvite.acceptedAt) {
        return res.status(409).json({ error: "An invitation has already been sent to this email" });
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const invitation = await storage.createInvitation({
        email,
        name,
        role,
        token,
        invitedBy: actor.id,
        expiresAt,
      });

      // Get inviter info for email
      const inviter = await storage.getUser(actor.id);
      const inviterName = inviter?.name || 'An administrator';

      // Send invitation email
      try {
        await sendInvitationEmail(email, name, token, inviterName, role);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Still return the invitation, but note the email issue
        return res.status(201).json({ 
          ...invitation, 
          emailSent: false,
          message: "Invitation created but email could not be sent"
        });
      }

      res.status(201).json({ ...invitation, emailSent: true });
    } catch (error) {
      console.error('Failed to create invitation:', error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/pending", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const invitations = await storage.listPendingInvitations();
      res.json(invitations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      res.json(invitation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation" });
    }
  });

  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password required" });
      }

      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      // Create the user
      const user = await storage.createUser({
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        password,
        authProvider: 'email',
        avatar: invitation.name.substring(0, 2).toUpperCase(),
      });

      // Mark invitation as accepted
      await storage.markInvitationAccepted(invitation.id);

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  app.delete("/api/invitations/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      await storage.deleteInvitation(req.params.id);
      res.json({ message: "Invitation deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invitation" });
    }
  });

  // Resend invitation for a pending invitation (by email)
  app.post("/api/invitations/resend", async (req, res) => {
    try {
      const actor = await requireAdminAccess(req, res);
      if (!actor) return;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // First check if user already exists and has a password (already activated)
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.password) {
        return res.status(400).json({ error: "User has already activated their account" });
      }

      // Check for existing invitation (pending or expired, but not accepted)
      const existingInvite = await storage.getInvitationByEmailIncludingExpired(email);
      
      if (!existingInvite) {
        return res.status(404).json({ error: "No invitation found for this email" });
      }

      if (existingInvite.acceptedAt) {
        return res.status(400).json({ error: "This invitation has already been accepted" });
      }

      // Generate new token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Update existing invitation with new token and expiry
      const invitation = await storage.updateInvitation(existingInvite.id, {
        token,
        expiresAt,
        invitedBy: actor.id,
      });

      // Get inviter info for email
      const inviter = await storage.getUser(actor.id);
      const inviterName = inviter?.name || 'An administrator';

      // Send invitation email using the invitation data
      const name = existingInvite.name;
      const role = existingInvite.role;
      
      try {
        await sendInvitationEmail(email, name, token, inviterName, role);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        return res.status(201).json({ 
          ...invitation, 
          emailSent: false,
          message: "Invitation updated but email could not be sent"
        });
      }

      res.status(200).json({ ...invitation, emailSent: true, message: "Invitation resent successfully" });
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.listCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const partialSchema = insertCategorySchema.partial();
      const data = partialSchema.parse(req.body);
      const category = await storage.updateCategory(req.params.id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Location routes
  app.get("/api/locations", async (req, res) => {
    try {
      const locations = await storage.listLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const actor = await requireAdminAccess(req, res);
      if (!actor) return;
      const data = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(data);
      // Auto-create a matching preparation project so the location appears in the rollup
      try {
        const existing = await storage.listProjects(location.id);
        if (existing.length === 0) {
          await storage.createProject({ buildingId: location.id, name: `Maintenance register · ${location.name}`, status: "Planning", createdBy: actor.id });
        }
      } catch (_) { /* non-fatal */ }
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  // Bulk upload locations from CSV data
  app.post("/api/locations/upload", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const { locations: locationData } = req.body;
      
      if (!Array.isArray(locationData) || locationData.length === 0) {
        return res.status(400).json({ error: "No location data provided" });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const item of locationData) {
        try {
          // Generate code from building + name (e.g., "A-PRIVE1")
          const code = `${item.building}-${item.name.toUpperCase().replace(/\s+/g, '')}`.substring(0, 20);
          
          const locationToCreate = {
            name: item.name,
            code: code,
            category: `Building ${item.building}`,
          };

          const loc = await storage.createLocation(locationToCreate);
          // Auto-create the matching preparation project
          try {
            const existing = await storage.listProjects(loc.id);
            if (existing.length === 0) {
              await storage.createProject({ buildingId: loc.id, name: `Maintenance register · ${loc.name}`, status: "Planning", createdBy: null });
            }
          } catch (_) { /* non-fatal */ }
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to create "${item.name}": ${error.message || 'Unknown error'}`);
        }
      }

      res.json({
        message: `Upload complete: ${results.success} locations created, ${results.failed} failed`,
        ...results,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.patch("/api/locations/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const partialSchema = insertLocationSchema.partial();
      const data = partialSchema.parse(req.body);
      const location = await storage.updateLocation(req.params.id, data);
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      await storage.deleteLocation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Task routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const actor = await getSessionUser(req);
      if (!actor) {
        return res.status(401).json({ error: "Please sign in to access tasks." });
      }
      const { locationId, status, assignedGroup, startDate, endDate } = req.query;

      const filters: any = {};
      if (locationId) filters.locationId = locationId as string;
      if (status) filters.status = status as string;
      if (assignedGroup) filters.assignedGroup = assignedGroup as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      console.log("Fetching tasks with filters:", filters);
      const tasks = await storage.listTasks(filters);
      console.log("Tasks fetched:", tasks.length);
      
      // Optimize response by replacing base64 images with thumbnails/placeholders
      // Full images can be fetched via individual task endpoints
      const optimizedTasks = tasks.filter(task => canReadTask(actor, task)).map(task => {
        if (task.imageUrl && task.imageUrl.startsWith('data:image')) {
          // Replace full base64 with a flag indicating image exists
          return {
            ...task,
            imageUrl: 'HAS_IMAGE', // Flag to indicate image exists
            hasImage: true
          };
        }
        // For URL images, also mark as hasImage so thumbnails are shown
        if (task.imageUrl && (task.imageUrl.startsWith('http://') || task.imageUrl.startsWith('https://'))) {
          return {
            ...task,
            hasImage: true
          };
        }
        return task;
      });
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.json(optimizedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error details:", { message: errorMessage, stack: errorStack });
      res.status(500).json({ 
        error: "Failed to fetch tasks",
        details: errorMessage,
        environment: process.env.NODE_ENV
      });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const actor = await getSessionUser(req);
      if (!actor) {
        return res.status(401).json({ error: "Please sign in to access tasks." });
      }
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (!canReadTask(actor, task)) {
        return res.status(403).json({ error: "You do not have access to this task." });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Endpoint to get task thumbnail image
  app.get("/api/tasks/:id/thumbnail", async (req, res) => {
    try {
      const actor = await getSessionUser(req);
      if (!actor) {
        return res.status(401).json({ error: "Please sign in to access tasks." });
      }
      const task = await storage.getTask(req.params.id);
      if (!task || !task.imageUrl) {
        return res.status(404).json({ error: "Image not found" });
      }
      if (!canReadTask(actor, task)) {
        return res.status(403).json({ error: "You do not have access to this task." });
      }
      
      // If it's a base64 image, convert and send
      if (task.imageUrl.startsWith('data:image')) {
        const matches = task.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const imageType = matches[1];
          const imageData = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', `image/${imageType}`);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(imageData);
        }
      }
      
      // If it's a URL, fetch and proxy the image to avoid CORS issues
      if (task.imageUrl.startsWith('http')) {
        try {
          const imageResponse = await fetch(task.imageUrl);
          if (!imageResponse.ok) {
            return res.status(404).json({ error: "Failed to fetch external image" });
          }
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(imageBuffer);
        } catch (fetchError) {
          console.error("Error fetching external image:", fetchError);
          return res.status(500).json({ error: "Failed to fetch external image" });
        }
      }
      
      res.status(404).json({ error: "Invalid image format" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch thumbnail" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      if (!await requireTaskManagementAccess(req, res)) return;
      console.log("Creating task with data:", { ...req.body, imageUrl: req.body.imageUrl ? `[image: ${req.body.imageUrl.substring(0, 50)}...]` : null });
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      console.log("Task created successfully:", task.id);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      if (!await requireTaskManagementAccess(req, res)) return;
      const partialSchema = insertTaskSchema.partial();
      const data = partialSchema.parse(req.body);
      
      // Get the current task before update to check for changes
      const currentTask = await storage.getTask(req.params.id);
      
      const task = await storage.updateTask(req.params.id, data);
      
      // Create notifications for relevant users
      if (currentTask) {
        // Notify when task is assigned to a new user
        if (data.assignedTo && data.assignedTo !== currentTask.assignedTo) {
          // Check if this is a Red Flag task and get count
          const isRedFlag = task.priority === "Red Flag";
          let notificationMessage = `You have been assigned to task: ${task.title}`;
          let notificationType = "task_assigned";
          
          if (isRedFlag) {
            const redFlagCount = await storage.getRedFlagTaskCountForUser(data.assignedTo);
            notificationMessage = `URGENT: You have been assigned a Red Flag task: ${task.title}. You now have ${redFlagCount} critical task${redFlagCount !== 1 ? 's' : ''} requiring immediate attention.`;
            notificationType = "red_flag_assigned";
          }
          
          await storage.createNotification({
            userId: data.assignedTo,
            type: notificationType,
            title: isRedFlag ? "Critical Task Assigned" : "New Task Assigned",
            message: notificationMessage,
            taskId: task.id,
            isRead: false,
          });
        }
        
        // Notify assigned user when status changes
        if (data.status && data.status !== currentTask.status && currentTask.assignedTo) {
          await storage.createNotification({
            userId: currentTask.assignedTo,
            type: "status_changed",
            title: "Task Status Updated",
            message: `Task "${task.title}" status changed to ${data.status}`,
            taskId: task.id,
            isRead: false,
          });
        }
        
        // Notify task creator when their task is updated
        if (task.createdBy && task.createdBy !== currentTask.assignedTo) {
          if (data.status && data.status !== currentTask.status) {
            await storage.createNotification({
              userId: task.createdBy,
              type: "task_updated",
              title: "Task Updated",
              message: `Your task "${task.title}" is now ${data.status}`,
              taskId: task.id,
              isRead: false,
            });
          }
        }
      }
      
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      if (!await requireTaskManagementAccess(req, res)) return;
      await storage.deleteTask(req.params.id);
      res.json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Notes routes
  app.post("/api/tasks/:taskId/notes", async (req, res) => {
    try {
      const actor = await requireTaskManagementAccess(req, res);
      if (!actor) return;
      const { content, recipients } = req.body;
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const recipientIds = Array.isArray(recipients)
        ? recipients
            .filter((recipient): recipient is string => typeof recipient === "string")
            .filter((recipient, index, list) => list.indexOf(recipient) === index)
        : [];
      const noteData = {
        taskId: req.params.taskId,
        content,
        createdBy: actor.id,
        recipients: recipientIds,
      };
      const note = await storage.createNote(noteData);
      
      // Notify all recipients
      if (recipientIds.length > 0) {
        for (const recipientId of recipientIds) {
          if (recipientId !== actor.id) {
            await storage.createNotification({
              userId: recipientId,
              type: "note_added",
              title: "New Note Added",
              message: `${actor.name} added a note to task: ${task.title}`,
              taskId: req.params.taskId,
              isRead: false,
            });
          }
        }
      }
      
      // Also notify the assigned user if not the creator and not in recipients
      if (task.assignedTo && task.assignedTo !== actor.id && !recipientIds.includes(task.assignedTo)) {
        await storage.createNotification({
          userId: task.assignedTo,
          type: "note_added",
          title: "New Note on Your Task",
          message: `${actor.name} added a note to: ${task.title}`,
          taskId: req.params.taskId,
          isRead: false,
        });
      }
      
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.get("/api/tasks/:taskId/notes", async (req, res) => {
    try {
      const actor = await getSessionUser(req);
      if (!actor) {
        return res.status(401).json({ error: "Please sign in to access task notes." });
      }
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const notes = await storage.listNotesByTask(req.params.taskId);
      if (canReadTask(actor, task)) {
        return res.json(notes);
      }

      const recipientNotes = notes.filter(note =>
        note.createdBy === actor.id || note.recipients?.includes(actor.id),
      );
      if (recipientNotes.length === 0) {
        return res.status(403).json({ error: "You do not have access to these task notes." });
      }
      res.json(recipientNotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Maintenance Groups routes
  app.get("/api/maintenance-groups", async (req, res) => {
    try {
      const groups = await storage.listMaintenanceGroups();
      const users = await storage.listUsers();
      
      // Calculate member count dynamically from users' groups array
      const groupsWithCounts = groups.map(group => {
        const memberCount = users.filter(u => u.groups?.includes(group.id)).length;
        return { ...group, memberCount };
      });
      
      res.json(groupsWithCounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch maintenance groups" });
    }
  });

  app.get("/api/maintenance-groups/:id", async (req, res) => {
    try {
      const group = await storage.getMaintenanceGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Maintenance group not found" });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch maintenance group" });
    }
  });

  app.post("/api/maintenance-groups", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const data = insertMaintenanceGroupSchema.parse(req.body);
      const group = await storage.createMaintenanceGroup(data);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create maintenance group" });
    }
  });

  app.patch("/api/maintenance-groups/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      const partialSchema = insertMaintenanceGroupSchema.partial();
      const data = partialSchema.parse(req.body);
      const group = await storage.updateMaintenanceGroup(req.params.id, data);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update maintenance group" });
    }
  });

  app.delete("/api/maintenance-groups/:id", async (req, res) => {
    try {
      if (!await requireAdminAccess(req, res)) return;
      await storage.deleteMaintenanceGroup(req.params.id);
      res.json({ message: "Maintenance group deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete maintenance group" });
    }
  });

  // Project Preparation — each endpoint verifies a real Admin or Coordinator.
  app.get("/api/preparations/buildings", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      res.json(await storage.listLocations());
    } catch (error) {
      console.error("Failed to fetch preparation buildings:", error);
      res.status(500).json({ error: "Failed to fetch buildings." });
    }
  });

  app.get("/api/preparations/projects", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const buildingId = typeof req.query.buildingId === "string" ? req.query.buildingId : undefined;
      res.json(await storage.listProjects(buildingId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects." });
    }
  });

  app.post("/api/preparations/projects", async (req, res) => {
    try {
      const actor = await requirePreparationAccess(req, res);
      if (!actor) return;
      const building = await storage.getLocation(req.body.buildingId);
      if (!building) return res.status(404).json({ error: "Building not found." });
      const project = await storage.createProject(insertProjectSchema.parse({
        ...req.body,
        createdBy: actor.id,
      }));
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create project." });
    }
  });

  app.patch("/api/preparations/projects/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getProject(req.params.id)) return res.status(404).json({ error: "Project not found." });
      if (req.body.buildingId && !await storage.getLocation(req.body.buildingId)) {
        return res.status(404).json({ error: "Building not found." });
      }
      const project = await storage.updateProject(req.params.id, insertProjectSchema.partial().parse(req.body));
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update project." });
    }
  });

  app.delete("/api/preparations/projects/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project." });
    }
  });

  // Ensure every location has a matching preparation project (idempotent backfill)
  app.post("/api/preparations/sync-location-projects", async (req, res) => {
    try {
      const actor = await requirePreparationAccess(req, res);
      if (!actor) return;
      const [allLocations, allProjects] = await Promise.all([storage.listLocations(), storage.listProjects()]);
      const coveredBuildingIds = new Set(allProjects.map((p: any) => p.buildingId));
      const missing = allLocations.filter((l: any) => !coveredBuildingIds.has(l.id));
      await Promise.all(missing.map((l: any) =>
        storage.createProject({ buildingId: l.id, name: `Maintenance register · ${l.name}`, status: "Planning", createdBy: actor.id })
      ));
      res.json({ created: missing.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to sync location projects." });
    }
  });

  app.get("/api/preparations/projects/:projectId/plans", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      res.json(await storage.listProjectPlans(req.params.projectId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch executive plans." });
    }
  });

  app.post("/api/preparations/projects/:projectId/plans", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getProject(req.params.projectId)) return res.status(404).json({ error: "Project not found." });
      const plan = await storage.createProjectPlan(insertProjectPlanSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      }));
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to save executive plan." });
    }
  });

  app.delete("/api/preparations/plans/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      await storage.deleteProjectPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete executive plan." });
    }
  });

  app.get("/api/preparations/trades", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      res.json(await storage.listTrades());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trades." });
    }
  });

  app.post("/api/preparations/trades", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const trade = await storage.createTrade(insertTradeSchema.parse(req.body));
      res.status(201).json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create trade." });
    }
  });

  app.patch("/api/preparations/trades/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      res.json(await storage.updateTrade(req.params.id, insertTradeSchema.partial().parse(req.body)));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update trade." });
    }
  });

  app.delete("/api/preparations/trades/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      await storage.deleteTrade(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete trade." });
    }
  });

  app.get("/api/preparations/projects/:projectId/source-scope", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found." });
      const location = await storage.getLocation(project.buildingId);
      if (!location) return res.status(404).json({ error: "Project location not found." });
      const existing = await storage.listProjectTasks();
      const imported = new Set(existing.map(task => task.sourceReference).filter(Boolean));
      res.json(preparationScope2026
        .filter(item => scopeMatchesLocation(item.building, location))
        .map(item => ({ ...item, sourceDocument: "Travaux 2026 - Cahier de charges", imported: imported.has(`travaux-2026:${item.id}`) })));
    } catch (error) {
      console.error("Failed to load preparation source scope:", error);
      res.status(500).json({ error: "Failed to load the 2026 work scope." });
    }
  });

  app.post("/api/preparations/projects/:projectId/import-source-scope", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found." });
      const location = await storage.getLocation(project.buildingId);
      if (!location) return res.status(404).json({ error: "Project location not found." });
      const { itemIds } = z.object({ itemIds: z.array(z.string()).min(1).max(100) }).parse(req.body);
      const sourceItems = Array.from(new Set(itemIds)).map(id => preparationScope2026.find(item => item.id === id));
      if (sourceItems.some(item => !item || !scopeMatchesLocation(item.building, location))) {
        return res.status(400).json({ error: "Selected source rows do not belong to this preparation location." });
      }
      const existing = await storage.listProjectTasks();
      const existingReferences = new Set(existing.map(task => task.sourceReference).filter(Boolean));
      if (sourceItems.some(item => existingReferences.has(`travaux-2026:${item!.id}`))) {
        return res.status(409).json({ error: "One or more selected PDF rows are already in the register." });
      }
      const trades = await storage.listTrades();
      const tradeByName = new Map(trades.map(trade => [trade.name.toLowerCase(), trade]));
      const imported = [];
      for (const sourceItem of sourceItems) {
        if (!sourceItem) continue;
        let trade = tradeByName.get(sourceItem.tradeName.toLowerCase());
        if (!trade) {
          trade = await storage.createTrade({ name: sourceItem.tradeName });
          tradeByName.set(trade.name.toLowerCase(), trade);
        }
        imported.push(await storage.createProjectTask({
          projectId: project.id,
          tradeId: trade.id,
          category: sourceItem.category,
          title: sourceItem.title,
          supplierName: sourceItem.supplierName,
          plannedFor: sourceItem.plannedFor,
          sourceDocument: "Travaux 2026 - Cahier de charges",
          sourceReference: `travaux-2026:${sourceItem.id}`,
          quantity: sourceItem.quantity,
          unitPrice: sourceItem.estimatedCost,
          estimatedCost: sourceItem.estimatedCost || "0",
          invoiceNumber: sourceItem.invoiceNumber,
          invoiceAmount: sourceItem.invoiceAmount,
          actualCost: sourceItem.invoiceAmount || "0",
          status: "Planned",
        }));
      }
      res.status(201).json(imported);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to import preparation source scope:", error);
      res.status(500).json({ error: "Failed to import the 2026 work scope." });
    }
  });

  app.post("/api/preparations/import-all-maintenance-tasks", async (req, res) => {
    try {
      const user = await requirePreparationAccess(req, res);
      if (!user) return;
      const [sourceTasks, locations, groups, projects, projectTasks, trades] = await Promise.all([
        storage.listTasks({}),
        storage.listLocations(),
        storage.listMaintenanceGroups(),
        storage.listProjects(),
        storage.listProjectTasks(),
        storage.listTrades(),
      ]);
      const importedSourceIds = new Set(projectTasks.map(task => task.sourceTaskId).filter(Boolean));
      const locationsById = new Map(locations.map(location => [location.id, location]));
      const groupsById = new Map(groups.map(group => [group.id, group.name]));
      const projectByLocation = new Map(projects.map(project => [project.buildingId, project]));
      const tradeByName = new Map(trades.map(trade => [trade.name.toLowerCase(), trade]));
      const imported = [];
      const skipped = [];
      for (const sourceTask of sourceTasks) {
        if (sourceTask.status === "Resolved" || importedSourceIds.has(sourceTask.id)) { skipped.push(sourceTask.id); continue; }
        const location = locationsById.get(sourceTask.locationId);
        if (!location) { skipped.push(sourceTask.id); continue; }
        let project = projectByLocation.get(location.id);
        if (!project) {
          project = await storage.createProject({
            buildingId: location.id,
            name: `Maintenance register · ${location.name}`,
            description: "Historical maintenance tasks imported for procurement tracking.",
            status: "Planning",
            createdBy: user.id,
          });
          projectByLocation.set(location.id, project);
        }
        const groupId = sourceTask.assignedGroups?.[0] || sourceTask.assignedGroup;
        const classification = classifyMaintenanceTask(groupId ? groupsById.get(groupId) : undefined, sourceTask.title);
        let trade = tradeByName.get(classification.tradeName.toLowerCase());
        if (!trade) {
          trade = await storage.createTrade({ name: classification.tradeName });
          tradeByName.set(trade.name.toLowerCase(), trade);
        }
        imported.push(await storage.createProjectTask({
          projectId: project.id,
          tradeId: trade.id,
          category: classification.category,
          sourceTaskId: sourceTask.id,
          title: sourceTask.title,
          productDescription: sourceTask.description || undefined,
          sourceDocument: "Maintenance app",
          status: sourceTask.status === "In Progress" ? "In progress" : "Planned",
          estimatedCost: "0",
          actualCost: "0",
        }));
      }
      res.status(201).json({ importedCount: imported.length, skippedCount: skipped.length, projects: Array.from(projectByLocation.values()) });
    } catch (error) {
      console.error("Failed to import historical maintenance tasks:", error);
      res.status(500).json({ error: "Failed to import historical maintenance tasks." });
    }
  });

  app.get("/api/preparations/projects/:projectId/importable-tasks", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found." });

      const [sourceTasks, groups, existingProjectTasks] = await Promise.all([
        storage.listTasks({ locationId: project.buildingId }),
        storage.listMaintenanceGroups(),
        storage.listProjectTasks(),
      ]);
      const groupNames = new Map(groups.map(group => [group.id, group.name]));
      const importedSourceIds = new Set(existingProjectTasks.map(task => task.sourceTaskId).filter(Boolean));
      const eligible = sourceTasks
        .filter(task => task.status !== "Resolved" && !importedSourceIds.has(task.id))
        .map(task => {
          const groupId = task.assignedGroups?.[0] || task.assignedGroup;
          const assignedGroupName = groupId ? groupNames.get(groupId) : undefined;
          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            createdAt: task.createdAt,
            assignedGroupName,
            ...classifyMaintenanceTask(assignedGroupName, task.title),
          };
        });
      res.json(eligible);
    } catch (error) {
      console.error("Failed to list importable maintenance tasks:", error);
      res.status(500).json({ error: "Failed to find maintenance tasks to import." });
    }
  });

  app.post("/api/preparations/projects/:projectId/import-tasks", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found." });
      const { taskIds } = z.object({ taskIds: z.array(z.string()).min(1).max(100) }).parse(req.body);
      const uniqueIds = Array.from(new Set(taskIds));
      const sourceTasks = await Promise.all(uniqueIds.map(id => storage.getTask(id)));
      if (sourceTasks.some(task => !task || task.locationId !== project.buildingId || task.status === "Resolved")) {
        return res.status(400).json({ error: "Only open maintenance tasks from this building can be imported." });
      }
      const alreadyImported = await Promise.all(uniqueIds.map(id => storage.getProjectTaskBySourceTaskId(id)));
      if (alreadyImported.some(Boolean)) {
        return res.status(409).json({ error: "One or more selected tasks have already been imported into a preparation register." });
      }

      const groups = await storage.listMaintenanceGroups();
      const groupNames = new Map(groups.map(group => [group.id, group.name]));
      const trades = await storage.listTrades();
      const tradeByName = new Map(trades.map(trade => [trade.name.trim().toLowerCase(), trade]));
      const imported = [];
      for (const sourceTask of sourceTasks) {
        if (!sourceTask) continue;
        const groupId = sourceTask.assignedGroups?.[0] || sourceTask.assignedGroup;
        const classification = classifyMaintenanceTask(groupId ? groupNames.get(groupId) : undefined, sourceTask.title);
        let trade = tradeByName.get(classification.tradeName.toLowerCase());
        if (!trade) {
          trade = await storage.createTrade({ name: classification.tradeName });
          tradeByName.set(trade.name.trim().toLowerCase(), trade);
        }
        imported.push(await storage.createProjectTask({
          projectId: project.id,
          tradeId: trade.id,
          category: classification.category,
          sourceTaskId: sourceTask.id,
          title: sourceTask.title,
          description: sourceTask.description || undefined,
          status: sourceTask.status === "In Progress" ? "In progress" : "Planned",
          estimatedCost: "0",
          actualCost: "0",
        }));
      }
      res.status(201).json(imported);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to import maintenance tasks:", error);
      res.status(500).json({ error: "Failed to import maintenance tasks." });
    }
  });

  app.get("/api/preparations/projects/:projectId/register", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getProject(req.params.projectId)) return res.status(404).json({ error: "Project not found." });
      const [projectTasks, trades] = await Promise.all([
        storage.listProjectTasks(req.params.projectId),
        storage.listTrades(),
      ]);
      const allQuotes = await Promise.all(projectTasks.map(task => storage.listQuotes(task.id)));
      const sourceTaskIds = Array.from(new Set(projectTasks.map(task => task.sourceTaskId).filter((id): id is string => Boolean(id))));
      const sourceTasks = await Promise.all(sourceTaskIds.map(id => storage.getTask(id)));
      const sourceHasImage = new Map<string, boolean>();
      for (const sourceTask of sourceTasks) {
        if (sourceTask) sourceHasImage.set(sourceTask.id, Boolean(sourceTask.imageUrl));
      }
      const taskRows = projectTasks.map((task, index) => {
        const quotes = allQuotes[index];
        const bestQuote = quotes.length ? Math.min(...quotes.map(quote => Number(quote.amount) || 0)) : 0;
        const unitPrice = task.unitPrice === null ? null : Number(task.unitPrice);
        const quantity = task.quantity === null ? null : Number(task.quantity);
        const lineTotal = unitPrice !== null && quantity !== null ? unitPrice * quantity : Number(task.estimatedCost) || 0;
        const invoiceAmount = task.invoiceAmount === null ? null : Number(task.invoiceAmount);
        return {
          ...task,
          unitPrice,
          quantity,
          lineTotal,
          invoiceAmount,
          bestQuote,
          quoteCount: quotes.length,
          sourceHasImage: task.sourceTaskId ? sourceHasImage.get(task.sourceTaskId) || false : false,
        };
      });
      const summarize = (keyFor: (task: typeof taskRows[number]) => string) => {
        const totals = new Map<string, { estimated: number; quoted: number; actual: number; taskCount: number }>();
        for (const task of taskRows) {
          const key = keyFor(task);
          const total = totals.get(key) || { estimated: 0, quoted: 0, actual: 0, taskCount: 0 };
          if (task.isActive) {
            total.estimated += task.lineTotal;
            total.quoted += task.bestQuote;
            total.actual += task.invoiceAmount ?? (Number(task.actualCost) || 0);
          }
          total.taskCount += 1;
          totals.set(key, total);
        }
        return Array.from(totals, ([name, total]) => ({ name, ...total, variance: total.estimated - total.actual }));
      };
      const tradeNames = new Map(trades.map(trade => [trade.id, trade.name]));
      const totals = taskRows.reduce((total, task) => task.isActive ? ({
        estimated: total.estimated + task.lineTotal,
        quoted: total.quoted + task.bestQuote,
        actual: total.actual + (task.invoiceAmount ?? (Number(task.actualCost) || 0)),
      }) : total, { estimated: 0, quoted: 0, actual: 0 });
      res.json({
        tasks: taskRows,
        totals: { ...totals, variance: totals.estimated - totals.actual },
        categories: summarize(task => task.category || "General Works"),
        trades: summarize(task => task.tradeId ? tradeNames.get(task.tradeId) || "Unassigned" : "Unassigned"),
      });
    } catch (error) {
      console.error("Failed to build preparation register:", error);
      res.status(500).json({ error: "Failed to load the preparation register." });
    }
  });

  app.get("/api/preparations/project-tasks", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
      res.json(await storage.listProjectTasks(projectId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project tasks." });
    }
  });

  app.post("/api/preparations/project-tasks", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getProject(req.body.projectId)) return res.status(404).json({ error: "Project not found." });
      if (req.body.tradeId && !(await storage.listTrades()).some(trade => trade.id === req.body.tradeId)) {
        return res.status(404).json({ error: "Trade not found." });
      }
      if (!hasValidNonNegativeCurrency(req.body, ["estimatedCost", "actualCost", "unitPrice", "quantity", "invoiceAmount"])) {
        return res.status(400).json({ error: "Costs must be non-negative numbers." });
      }
      const { sourceTaskId: _sourceTaskId, ...taskInput } = req.body;
      const data = normalizeCurrencyFields(taskInput, ["estimatedCost", "actualCost", "unitPrice", "quantity", "invoiceAmount"]);
      const task = await storage.createProjectTask(insertProjectTaskSchema.parse(data));
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create project task." });
    }
  });

  app.patch("/api/preparations/project-tasks/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const existingTask = await storage.getProjectTask(req.params.id);
      if (!existingTask) return res.status(404).json({ error: "Project task not found." });
      if (existingTask.sourceTaskId && req.body.projectId && req.body.projectId !== existingTask.projectId) {
        return res.status(400).json({ error: "Imported maintenance tasks cannot be moved to another project." });
      }
      if (req.body.projectId && !await storage.getProject(req.body.projectId)) {
        return res.status(404).json({ error: "Project not found." });
      }
      if (req.body.tradeId && !(await storage.listTrades()).some(trade => trade.id === req.body.tradeId)) {
        return res.status(404).json({ error: "Trade not found." });
      }
      if (!hasValidNonNegativeCurrency(req.body, ["estimatedCost", "actualCost", "unitPrice", "quantity", "invoiceAmount"])) {
        return res.status(400).json({ error: "Costs must be non-negative numbers." });
      }
      const { sourceTaskId: _sourceTaskId, ...taskInput } = req.body;
      const data = normalizeCurrencyFields(taskInput, ["estimatedCost", "actualCost", "unitPrice", "quantity", "invoiceAmount"]);
      res.json(await storage.updateProjectTask(req.params.id, insertProjectTaskSchema.partial().parse(data)));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update project task." });
    }
  });

  app.delete("/api/preparations/project-tasks/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const task = await storage.getProjectTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Project task not found." });
      if (task.sourceTaskId) {
        return res.status(400).json({ error: "Imported maintenance tasks remain linked for traceability and cannot be deleted. Update their status or costs instead." });
      }
      await storage.deleteProjectTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project task." });
    }
  });

  app.get("/api/preparations/project-tasks/:taskId/quotes", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      res.json(await storage.listQuotes(req.params.taskId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes." });
    }
  });

  app.post("/api/preparations/project-tasks/:taskId/quotes", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getProjectTask(req.params.taskId)) return res.status(404).json({ error: "Project task not found." });
      if (!hasValidNonNegativeCurrency(req.body, ["amount"])) {
        return res.status(400).json({ error: "Quote amount must be a non-negative number." });
      }
      const data = normalizeCurrencyFields({ ...req.body, projectTaskId: req.params.taskId }, ["amount"]);
      const quote = await storage.createQuote(insertQuoteSchema.parse(data));
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create quote." });
    }
  });

  app.patch("/api/preparations/quotes/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      if (!await storage.getQuote(req.params.id)) return res.status(404).json({ error: "Quote not found." });
      if (!hasValidNonNegativeCurrency(req.body, ["amount"])) {
        return res.status(400).json({ error: "Quote amount must be a non-negative number." });
      }
      const { projectTaskId: _projectTaskId, ...quoteUpdates } = req.body;
      const data = normalizeCurrencyFields(quoteUpdates, ["amount"]);
      res.json(await storage.updateQuote(req.params.id, insertQuoteSchema.partial().parse(data)));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update quote." });
    }
  });

  app.delete("/api/preparations/quotes/:id", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      await storage.deleteQuote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote." });
    }
  });

  app.post("/api/preparations/upload-url", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const { name, size, contentType } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "A file name is required." });
      if (!name.toLowerCase().endsWith(".pdf") || contentType !== "application/pdf") {
        return res.status(400).json({ error: "Preparation documents, including invoices, must be PDF files." });
      }
      if (!Number.isInteger(size) || size <= 0 || size > 25 * 1024 * 1024) {
        return res.status(400).json({ error: "PDF files must be between 1 byte and 25 MB." });
      }
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL("preparations");
      res.json({
        uploadURL,
        objectPath: objectStorage.normalizeObjectEntityPath(uploadURL),
        metadata: { name, size, contentType: contentType || "application/pdf" },
      });
    } catch (error) {
      console.error("Failed to create preparation upload URL:", error);
      res.status(500).json({ error: "Failed to prepare file upload." });
    }
  });

  app.get("/api/preparations/rollups", async (req, res) => {
    try {
      if (!await requirePreparationAccess(req, res)) return;
      const [projects, projectTasks, trades] = await Promise.all([
        storage.listProjects(),
        storage.listProjectTasks(),
        storage.listTrades(),
      ]);
      const allQuotes = await Promise.all(projectTasks.map(task => storage.listQuotes(task.id)));
      const sourceTaskIds = Array.from(new Set(projectTasks.map(task => task.sourceTaskId).filter((id): id is string => Boolean(id))));
      const sourceTasks = await Promise.all(sourceTaskIds.map(id => storage.getTask(id)));
      const sourceHasImage = new Map<string, boolean>();
      for (const sourceTask of sourceTasks) {
        if (sourceTask) sourceHasImage.set(sourceTask.id, Boolean(sourceTask.imageUrl));
      }
      const projectBuilding = new Map(projects.map(project => [project.id, project.buildingId]));
      const projectNames = new Map(projects.map(project => [project.id, project.name]));
      const tradeNames = new Map(trades.map(trade => [trade.id, trade.name]));
      type Rollup = { estimated: number; quoted: number; actual: number; taskCount: number };
      const addTo = (totals: Map<string, Rollup>, key: string, costs: Omit<Rollup, "taskCount">) => {
        const total = totals.get(key) || { estimated: 0, quoted: 0, actual: 0, taskCount: 0 };
        total.estimated += costs.estimated;
        total.quoted += costs.quoted;
        total.actual += costs.actual;
        total.taskCount += 1;
        totals.set(key, total);
      };
      const buildingTotals = new Map<string, Rollup>();
      const tradeTotals = new Map<string, Rollup>();
      const categoryTotals = new Map<string, Rollup>();
      const projectTotals = new Map<string, Rollup>();
      const grandTotal = { estimated: 0, quoted: 0, actual: 0 };
      type TaskSummary = {
        id: string; title: string; description?: string | null; productDescription?: string | null;
        projectId: string; projectName: string; buildingId: string;
        supplierName?: string | null; unitPrice?: number | null; quantity?: number | null; lineTotal?: number | null;
        estimatedCost: number; actualCost: number; invoiceAmount?: number | null;
        invoiceNumber?: string | null; invoiceFileUrl?: string | null; invoiceFileName?: string | null;
        plannedFor?: string | null; sourceTaskId?: string | null; sourceHasImage: boolean; isActive: boolean; tradeId?: string | null;
        category: string; status?: string | null;
      };
      const categoryTasks = new Map<string, TaskSummary[]>();
      const tradeTasks = new Map<string, TaskSummary[]>();
      const projectTasksMap = new Map<string, TaskSummary[]>();

      for (let index = 0; index < projectTasks.length; index += 1) {
        const task = projectTasks[index];
        const unitPrice = task.unitPrice === null ? null : Number(task.unitPrice);
        const quantity = task.quantity === null ? null : Number(task.quantity);
        const estimatedCost = unitPrice !== null && quantity !== null
          ? unitPrice * quantity
          : Number(task.estimatedCost) || 0;
        const actualCost = task.invoiceAmount === null
          ? Number(task.actualCost) || 0
          : Number(task.invoiceAmount);
        const quotes = allQuotes[index];
        const quotedCost = quotes.length ? Math.min(...quotes.map(quote => Number(quote.amount) || 0)) : 0;
        const costs = task.isActive ? { estimated: estimatedCost, quoted: quotedCost, actual: actualCost } : { estimated: 0, quoted: 0, actual: 0 };
        grandTotal.estimated += costs.estimated;
        grandTotal.quoted += costs.quoted;
        grandTotal.actual += costs.actual;
        const buildingId = projectBuilding.get(task.projectId);
        if (buildingId) addTo(buildingTotals, buildingId, costs);
        addTo(projectTotals, task.projectId, costs);
        const catKey = task.category || "General Works";
        const tradeKey = task.tradeId ? tradeNames.get(task.tradeId) || "Unassigned" : "Unassigned";
        addTo(categoryTotals, catKey, costs);
        addTo(tradeTotals, tradeKey, costs);
        const summary: TaskSummary = {
          id: task.id, title: task.title, description: task.description,
          productDescription: task.productDescription,
          projectId: task.projectId, projectName: projectNames.get(task.projectId) || "Untitled",
          buildingId: buildingId || "",
          supplierName: task.supplierName, unitPrice, quantity,
          lineTotal: unitPrice !== null && quantity !== null ? unitPrice * quantity : null,
          estimatedCost, actualCost,
          invoiceAmount: task.invoiceAmount === null ? null : Number(task.invoiceAmount),
          invoiceNumber: task.invoiceNumber, invoiceFileUrl: task.invoiceFileUrl,
          invoiceFileName: task.invoiceFileName, plannedFor: task.plannedFor,
          sourceTaskId: task.sourceTaskId,
          sourceHasImage: task.sourceTaskId ? sourceHasImage.get(task.sourceTaskId) || false : false,
          isActive: task.isActive,
          tradeId: task.tradeId, category: catKey, status: task.status,
        };
        if (!categoryTasks.has(catKey)) categoryTasks.set(catKey, []);
        categoryTasks.get(catKey)!.push(summary);
        if (!tradeTasks.has(tradeKey)) tradeTasks.set(tradeKey, []);
        tradeTasks.get(tradeKey)!.push(summary);
        if (!projectTasksMap.has(task.projectId)) projectTasksMap.set(task.projectId, []);
        projectTasksMap.get(task.projectId)!.push(summary);
      }
      const toLines = (totals: Map<string, Rollup>, tasksMap?: Map<string, TaskSummary[]>) =>
        Array.from(totals, ([name, total]) => ({ name, ...total, variance: total.estimated - total.actual, tasks: tasksMap?.get(name) ?? [] }));
      res.json({
        grandTotal: { ...grandTotal, variance: grandTotal.estimated - grandTotal.actual },
        buildings: toLines(buildingTotals).map(line => ({ ...line, buildingId: line.name })),
        projects: toLines(projectTotals, projectTasksMap).map(line => ({ ...line, projectId: line.name, name: projectNames.get(line.name) || "Untitled project" })),
        categories: toLines(categoryTotals, categoryTasks),
        trades: toLines(tradeTotals, tradeTasks),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate cost rollups." });
    }
  });

  // Password Reset
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, currentPassword, newPassword } = req.body;
      
      if (!email || !currentPassword || !newPassword) {
        return res.status(400).json({ error: "Email, current password, and new password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await storage.verifyPassword(user.id, currentPassword);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      // Update to new password
      await storage.updatePassword(user.id, newPassword);
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Password reset failed" });
    }
  });

  // AI Processing Endpoint
  app.post("/api/ai/process-task", async (req, res) => {
    try {
      const { input, hasPhoto } = req.body;

      if (!input || !input.trim()) {
        return res.status(400).json({ error: "Input text required" });
      }

      // Import OpenAI using the Replit AI Integrations credentials
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const prompt = `You are an AI assistant for a French hotel maintenance management system. 
      
Your task is to analyze maintenance issue descriptions and generate professional, clear task information in French.

User input (may be in any language): "${input}"

Please analyze this input and provide:
1. A short, professional title in French (max 60 characters)
2. A clear, detailed description in French (2-3 sentences)
3. Suggested priority level: "Red Flag" (urgent/dangerous), "High" (needs quick attention), "Normal" (routine maintenance), or "Low" (minor/cosmetic)
4. Try to identify the location if mentioned (e.g., "Suite B2", "Restaurant", "Piscine")
5. Try to identify the maintenance group: "Plomberie" (plumbing/water), "Électricité" (electrical), "Ménage" (cleaning), "Général" (general maintenance), or "Piscine" (pool)

Respond ONLY with valid JSON in this exact format:
{
  "title": "French title here",
  "description": "French description here",
  "priority": "Normal",
  "locationId": "",
  "assignedGroup": ""
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant that processes maintenance requests for a French hotel. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      
      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("Failed to parse AI response");
        }
      }

      res.json(result);
    } catch (error) {
      console.error("AI processing error:", error);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  // Notification routes
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const notifications = await storage.listNotificationsByUser(req.params.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/:userId/unread-count", async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.params.userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/:userId/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.params.userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Activity Log routes
  app.get("/api/activity-log", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const entries = await storage.listActivityLogs(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(entries);
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
      res.status(500).json({ error: "Failed to fetch activity log" });
    }
  });

  app.post("/api/activity-log", async (req, res) => {
    try {
      const data = insertActivityLogSchema.parse(req.body);
      const entry = await storage.createActivityLog(data);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create activity log entry:", error);
      res.status(500).json({ error: "Failed to create activity log entry" });
    }
  });

  app.put("/api/activity-log/:id", async (req, res) => {
    try {
      const entry = await storage.updateActivityLog(req.params.id, req.body);
      res.json(entry);
    } catch (error) {
      console.error("Failed to update activity log entry:", error);
      res.status(500).json({ error: "Failed to update activity log entry" });
    }
  });

  app.delete("/api/activity-log/:id", async (req, res) => {
    try {
      await storage.deleteActivityLog(req.params.id);
      res.json({ message: "Activity log entry deleted" });
    } catch (error) {
      console.error("Failed to delete activity log entry:", error);
      res.status(500).json({ error: "Failed to delete activity log entry" });
    }
  });

  // AI format activity log content to French bullet points
  app.post("/api/ai/format-activity", async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Import OpenAI using the Replit AI Integrations credentials
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const prompt = `Convert the following text into short, professional French bullet points for a work activity log. 
Keep it concise and action-oriented. Use proper French.
Only output the bullet points, nothing else.

Text to convert:
${content}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional assistant that formats work activity logs into concise French bullet points. Keep each point short and action-focused."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 300,
      });

      const formatted = completion.choices[0]?.message?.content || content;
      res.json({ formatted });
    } catch (error) {
      console.error("AI format error:", error);
      res.status(500).json({ error: "Failed to format with AI" });
    }
  });

  // Generate daily resolved tasks summary for Activity Log
  app.post("/api/activity-log/generate-daily-summary", async (req, res) => {
    try {
      const targetDate = req.body.date ? new Date(req.body.date) : new Date();
      
      // Get all resolved tasks for that day
      const resolvedTasks = await storage.getResolvedTasksForDate(targetDate);
      
      if (resolvedTasks.length === 0) {
        return res.json({ message: "No resolved tasks for this date", tasksCount: 0 });
      }

      // Get locations to map IDs to names
      const locations = await storage.listLocations();
      const locationMap = new Map(locations.map(l => [l.id, l.name]));

      // Format the summary as a list of title + location
      const summaryLines = resolvedTasks.map(task => {
        const locationName = locationMap.get(task.locationId) || task.locationId;
        return `• ${task.title} - ${locationName}`;
      });

      const dateStr = targetDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      const content = `📋 Tâches résolues le ${dateStr}:\n\n${summaryLines.join("\n")}`;

      // Create the activity log entry
      const entry = await storage.createActivityLog({
        content,
        authorId: "system",
        authorName: "Système Automatique",
        entryDate: targetDate,
      });

      res.json({ 
        message: "Daily summary created", 
        tasksCount: resolvedTasks.length,
        entry 
      });
    } catch (error) {
      console.error("Failed to generate daily summary:", error);
      res.status(500).json({ error: "Failed to generate daily summary" });
    }
  });

  // Shopping Items Routes
  app.get("/api/shopping-items", async (req, res) => {
    try {
      const items = await storage.listShoppingItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shopping items" });
    }
  });

  app.post("/api/shopping-items", async (req, res) => {
    try {
      const item = await storage.createShoppingItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create shopping item" });
    }
  });

  app.delete("/api/shopping-items/:id", async (req, res) => {
    try {
      await storage.deleteShoppingItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete shopping item" });
    }
  });

  // Start the daily summary scheduler (runs every hour, checks if it's after 23:00)
  let lastSummaryDate: string | null = null;
  
  const checkAndGenerateDailySummary = async () => {
    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toISOString().split("T")[0];
    
    // Run after 23:00 and only once per day
    if (hour >= 23 && lastSummaryDate !== todayStr) {
      console.log(`[Daily Summary] Generating summary for ${todayStr}...`);
      try {
        const resolvedTasks = await storage.getResolvedTasksForDate(now);
        
        if (resolvedTasks.length > 0) {
          const locations = await storage.listLocations();
          const locationMap = new Map(locations.map(l => [l.id, l.name]));

          const summaryLines = resolvedTasks.map(task => {
            const locationName = locationMap.get(task.locationId) || task.locationId;
            return `• ${task.title} - ${locationName}`;
          });

          const dateStr = now.toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          });

          const content = `📋 Tâches résolues le ${dateStr}:\n\n${summaryLines.join("\n")}`;

          await storage.createActivityLog({
            content,
            authorId: "system",
            authorName: "Système Automatique",
            entryDate: now,
          });

          console.log(`[Daily Summary] Created summary with ${resolvedTasks.length} tasks`);
        } else {
          console.log(`[Daily Summary] No resolved tasks for ${todayStr}`);
        }
        
        lastSummaryDate = todayStr;
      } catch (error) {
        console.error("[Daily Summary] Error:", error);
      }
    }
  };

  // Check every 30 minutes
  setInterval(checkAndGenerateDailySummary, 30 * 60 * 1000);
  // Also check on startup
  setTimeout(checkAndGenerateDailySummary, 5000);

  const httpServer = createServer(app);

  return httpServer;
}
