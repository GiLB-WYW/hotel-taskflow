import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"), // Hashed password (bcrypt), optional for OAuth users
  role: varchar("role").notNull().default("Basic Staff"), // Admin, Manager, Personnel, Basic Staff
  groups: text("groups").array(), // Array of maintenance group IDs (user can be in multiple groups)
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

// Supplier catalogue managed by administrators. A supplier can serve more than one group.
export const suppliersTable = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  mobilePhone: text("mobile_phone"),
  email: text("email"),
  website: text("website"),
  siret: text("siret"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const maintenanceGroupSuppliersTable = pgTable("maintenance_group_suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  maintenanceGroupId: varchar("maintenance_group_id").notNull().references(() => maintenanceGroupsTable.id, { onDelete: "cascade" }),
  supplierId: varchar("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
}, (table) => ({
  maintenanceGroupSupplierUnique: uniqueIndex("maintenance_group_suppliers_group_supplier_unique")
    .on(table.maintenanceGroupId, table.supplierId),
}));

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
  assignedGroup: varchar("assigned_group"), // Legacy single group ID (kept for backward compat)
  assignedGroups: text("assigned_groups").array(), // Array of maintenance group IDs
  createdBy: varchar("created_by").notNull(), // User ID
  imageUrl: text("image_url"),
  attachmentUrl: text("attachment_url"), // Uploaded file attachment
  linkUrl: text("link_url"), // External URL reference
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

// Shopping list table - products to buy for maintenance tasks
export const shoppingItemsTable = pgTable("shopping_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1),
  taskId: varchar("task_id"), // Optional reference to related task
  addedBy: varchar("added_by").notNull(), // User ID who added this item
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Activity log table - team daily updates
export const activityLogTable = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(), // The log entry content
  authorId: varchar("author_id").notNull(), // User who wrote this entry
  authorName: text("author_name").notNull(), // Cached author name for display
  entryDate: timestamp("entry_date").notNull(), // The date this entry is for
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Project preparation records. Buildings reuse existing locations so preparation
// planning remains connected to the hotel's location data.
export const projectsTable = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar("building_id").notNull().references(() => locationsTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("Planning"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const projectPlansTable = pgTable("project_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const tradesTable = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// A supplier can cover multiple preparation trades/categories.
export const supplierTradesTable = pgTable("supplier_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  tradeId: varchar("trade_id").notNull().references(() => tradesTable.id, { onDelete: "cascade" }),
}, (table) => ({
  supplierTradeUnique: uniqueIndex("supplier_trades_supplier_trade_unique")
    .on(table.supplierId, table.tradeId),
}));

export const projectTasksTable = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  tradeId: varchar("trade_id").references(() => tradesTable.id, { onDelete: "set null" }),
  category: varchar("category").notNull().default("General works"),
  sourceTaskId: varchar("source_task_id").unique().references(() => tasksTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  productDescription: text("product_description"),
  supplierName: text("supplier_name"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }),
  plannedFor: varchar("planned_for"),
  sourceDocument: text("source_document"),
  sourceReference: varchar("source_reference").unique(),
  invoiceNumber: varchar("invoice_number"),
  invoiceAmount: numeric("invoice_amount", { precision: 12, scale: 2 }),
  invoiceFileName: text("invoice_file_name"),
  invoiceFileUrl: text("invoice_file_url"),
  status: varchar("status").notNull().default("Planned"),
  isActive: boolean("is_active").notNull().default(true),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const quotesTable = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTaskId: varchar("project_task_id").notNull().references(() => projectTasksTable.id, { onDelete: "cascade" }),
  supplierName: text("supplier_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
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

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({
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

export const insertActivityLogSchema = createInsertSchema(activityLogTable, {
  entryDate: z.union([z.date(), z.string().transform(s => new Date(s))]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShoppingItemSchema = createInsertSchema(shoppingItemsTable).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectPlanSchema = createInsertSchema(projectPlansTable).omit({
  id: true,
  createdAt: true,
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({
  id: true,
  createdAt: true,
});

export const insertProjectTaskSchema = createInsertSchema(projectTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select types
export type User = typeof usersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
export type MaintenanceGroup = typeof maintenanceGroupsTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type MaintenanceGroupSupplier = typeof maintenanceGroupSuppliersTable.$inferSelect;
export type SupplierTrade = typeof supplierTradesTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type Note = typeof notesTable.$inferSelect;
export type Invitation = typeof invitationsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type ActivityLog = typeof activityLogTable.$inferSelect;
export type ShoppingItem = typeof shoppingItemsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectPlan = typeof projectPlansTable.$inferSelect;
export type Trade = typeof tradesTable.$inferSelect;
export type ProjectTask = typeof projectTasksTable.$inferSelect;
export type Quote = typeof quotesTable.$inferSelect;

// Insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertMaintenanceGroup = z.infer<typeof insertMaintenanceGroupSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type InsertShoppingItem = z.infer<typeof insertShoppingItemSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectPlan = z.infer<typeof insertProjectPlanSchema>;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
