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

// Categories table
export const categoriesTable = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Locations table
export const locationsTable = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // Reference to category name
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

// Notes table
export const notesTable = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by").notNull(), // User ID
  recipients: text("recipients").array(), // Array of user IDs who should be notified
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Invitations table
export const invitationsTable = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: varchar("role").notNull().default("Basic Staff"),
  token: varchar("token").notNull().unique(), // Unique invitation token
  invitedBy: varchar("invited_by").notNull(), // Admin user ID who sent the invite
  expiresAt: timestamp("expires_at").notNull(), // Invitation expiry
  acceptedAt: timestamp("accepted_at"), // When the user accepted and created account
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Notifications table
export const notificationsTable = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // User who receives this notification
  type: varchar("type").notNull(), // task_assigned, task_updated, note_added, status_changed
  title: text("title").notNull(),
  message: text("message").notNull(),
  taskId: varchar("task_id"), // Related task ID (for navigation)
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
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

export const insertNoteSchema = createInsertSchema(notesTable).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

// Select types
export type User = typeof usersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
export type MaintenanceGroup = typeof maintenanceGroupsTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type Note = typeof notesTable.$inferSelect;
export type Invitation = typeof invitationsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;

// Insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertMaintenanceGroup = z.infer<typeof insertMaintenanceGroupSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
