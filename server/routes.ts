import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTaskSchema, insertLocationSchema, insertMaintenanceGroupSchema } from "@shared/schema";
import { z } from "zod";

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
      
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // If user has a password, verify it
      if (user.password) {
        if (!password) {
          return res.status(400).json({ error: "Password required" });
        }

        const isValid = await storage.verifyPassword(user.id, password);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      // Don't send password hash to client
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
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
      res.json(users);
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
      const { name, email, role, password } = req.body;
      const updates: any = {};
      
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;
      
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
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const partialSchema = insertTaskSchema.partial();
      const data = partialSchema.parse(req.body);
      const task = await storage.updateTask(req.params.id, data);
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
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

  const httpServer = createServer(app);

  return httpServer;
}
