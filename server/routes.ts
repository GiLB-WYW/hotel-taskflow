import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTaskSchema, insertLocationSchema, insertMaintenanceGroupSchema, insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { sendInvitationEmail } from "./email";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(data.email);
      
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      const user = await storage.createUser(data);
      res.status(201).json(user);
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

      // If user has a password, verify it
      if (user.password) {
        if (!password) {
          return res.status(400).json({ error: "Password required" });
        }

        console.log("Verifying password for user:", user.id);
        const isValid = await storage.verifyPassword(user.id, password);
        console.log("Password valid:", isValid);
        
        if (!isValid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      // Don't send password hash to client
      const { password: _, ...userWithoutPassword } = user;
      console.log("Login successful for:", email);
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/oauth", async (req, res) => {
    try {
      const { authProvider, authId, name, email } = req.body;
      
      if (!authProvider || !authId || !email) {
        return res.status(400).json({ error: "Missing required OAuth fields" });
      }

      // Try to find existing user by OAuth ID
      let user = await storage.getUserByAuthId(authProvider, authId);
      
      if (!user) {
        // Try to find by email
        user = await storage.getUserByEmail(email);
        
        if (user) {
          // Link OAuth to existing account
          user = await storage.updateUser(user.id, {
            authProvider,
            authId,
          });
        } else {
          // Create new user
          user = await storage.createUser({
            name: name || email,
            email,
            authProvider,
            authId,
          });
        }
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "OAuth login failed" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
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
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { name, email, role, password, group } = req.body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;
      if (group !== undefined) updates.group = group;
      
      const user = await storage.updateUser(req.params.id, updates);
      
      if (password) {
        await storage.updatePassword(req.params.id, password);
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
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
      
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "User ID and new password required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user has a password, verify the current one
      if (user.password && currentPassword) {
        const isValid = await storage.verifyPassword(userId, currentPassword);
        if (!isValid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      await storage.updatePassword(userId, newPassword);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Invitation routes
  app.post("/api/invitations", async (req, res) => {
    try {
      const { email, name, role, invitedBy } = req.body;

      if (!email || !name || !role || !invitedBy) {
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
        invitedBy,
        expiresAt,
      });

      // Get inviter info for email
      const inviter = await storage.getUser(invitedBy);
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
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  app.delete("/api/invitations/:id", async (req, res) => {
    try {
      await storage.deleteInvitation(req.params.id);
      res.json({ message: "Invitation deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invitation" });
    }
  });

  // Resend invitation for a pending invitation (by email)
  app.post("/api/invitations/resend", async (req, res) => {
    try {
      const { email, invitedBy } = req.body;

      if (!email || !invitedBy) {
        return res.status(400).json({ error: "Missing required fields (email, invitedBy)" });
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
        invitedBy,
      });

      // Get inviter info for email
      const inviter = await storage.getUser(invitedBy);
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
      const data = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(data);
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

          await storage.createLocation(locationToCreate);
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
      await storage.deleteLocation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Task routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const { locationId, status, assignedGroup, startDate, endDate } = req.query;

      const filters: any = {};
      if (locationId) filters.locationId = locationId as string;
      if (status) filters.status = status as string;
      if (assignedGroup) filters.assignedGroup = assignedGroup as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const tasks = await storage.listTasks(filters);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
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
      const partialSchema = insertTaskSchema.partial();
      const data = partialSchema.parse(req.body);
      
      // Get the current task before update to check for changes
      const currentTask = await storage.getTask(req.params.id);
      
      const task = await storage.updateTask(req.params.id, data);
      
      // Create notifications for relevant users
      if (currentTask) {
        // Notify when task is assigned to a new user
        if (data.assignedTo && data.assignedTo !== currentTask.assignedTo) {
          await storage.createNotification({
            userId: data.assignedTo,
            type: "task_assigned",
            title: "New Task Assigned",
            message: `You have been assigned to task: ${task.title}`,
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
      await storage.deleteTask(req.params.id);
      res.json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Notes routes
  app.post("/api/tasks/:taskId/notes", async (req, res) => {
    try {
      const { content, createdBy, recipients } = req.body;
      const noteData = {
        taskId: req.params.taskId,
        content,
        createdBy,
        recipients: recipients || [],
      };
      const note = await storage.createNote(noteData);
      
      // Get task and creator info for notification
      const task = await storage.getTask(req.params.taskId);
      const creator = await storage.getUser(createdBy);
      
      // Notify all recipients
      if (recipients && recipients.length > 0 && task) {
        for (const recipientId of recipients) {
          if (recipientId !== createdBy) {
            await storage.createNotification({
              userId: recipientId,
              type: "note_added",
              title: "New Note Added",
              message: `${creator?.name || 'Someone'} added a note to task: ${task.title}`,
              taskId: req.params.taskId,
              isRead: false,
            });
          }
        }
      }
      
      // Also notify the assigned user if not the creator and not in recipients
      if (task?.assignedTo && task.assignedTo !== createdBy && !recipients?.includes(task.assignedTo)) {
        await storage.createNotification({
          userId: task.assignedTo,
          type: "note_added",
          title: "New Note on Your Task",
          message: `${creator?.name || 'Someone'} added a note to: ${task.title}`,
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
      const notes = await storage.listNotesByTask(req.params.taskId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Maintenance Groups routes
  app.get("/api/maintenance-groups", async (req, res) => {
    try {
      const groups = await storage.listMaintenanceGroups();
      res.json(groups);
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
      await storage.deleteMaintenanceGroup(req.params.id);
      res.json({ message: "Maintenance group deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete maintenance group" });
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

  const httpServer = createServer(app);

  return httpServer;
}
