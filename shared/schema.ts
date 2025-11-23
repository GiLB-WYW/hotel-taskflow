import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"), // Hashed password (bcrypt), optional for OAuth users
  role: varchar("role").notNull().default("Basic Staff"), // Admin, Manager, Personnel, Basic Staff
  group: varchar("group"), // Maintenance group ID
  authProvider: varchar("auth_provider").default("email"), // email, google, microsoft
  authId: text("auth_id"), // External ID for OAuth
  avatar: text("avatar"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Locations table
export const locationsTable = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // Restaurant, Suites B, Suites C, Technical, Pool Machinery
  code: varchar("code").unique(), // For quick search (e.g., "C2", "R1")
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Maintenance Groups table
export const maintenanceGroupsTable = pgTable("maintenance_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Plomberie, Électricité, Ménage, Général, Piscine
  description: text("description"),
  memberCount: integer("member_count").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Tasks table
export const tasksTable = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  originalTranscript: text("original_transcript"), // STT original text
  detectedLanguage: varchar("detected_language"), // Language from STT
  locationId: varchar("location_id").notNull(),
  priority: varchar("priority").notNull(), // Red Flag, High, Normal, Low
  status: varchar("status").notNull().default("Open"), // Open, In Progress, Resolved
  assignedTo: varchar("assigned_to"), // User ID
  assignedGroup: varchar("assigned_group"), // Maintenance group ID
  createdBy: varchar("created_by").notNull(), // User ID
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({
  id: true,
  createdAt: true,
});

export const insertMaintenanceGroupSchema = createInsertSchema(maintenanceGroupsTable).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select types
export type User = typeof usersTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
export type MaintenanceGroup = typeof maintenanceGroupsTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;

// Insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertMaintenanceGroup = z.infer<typeof insertMaintenanceGroupSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
