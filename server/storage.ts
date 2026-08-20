import { db } from "./db";
import {
  type User,
  type InsertUser,
  type Category,
  type InsertCategory,
  type Location,
  type InsertLocation,
  type MaintenanceGroup,
  type InsertMaintenanceGroup,
  type Task,
  type InsertTask,
  type Note,
  type InsertNote,
  type Invitation,
  type InsertInvitation,
  type Notification,
  type InsertNotification,
  type ActivityLog,
  type InsertActivityLog,
  type ShoppingItem,
  type InsertShoppingItem,
  type Project,
  type InsertProject,
  type ProjectPlan,
  type InsertProjectPlan,
  type Trade,
  type InsertTrade,
  type ProjectTask,
  type InsertProjectTask,
  type Quote,
  type InsertQuote,
  usersTable,
  categoriesTable,
  locationsTable,
  maintenanceGroupsTable,
  tasksTable,
  notesTable,
  invitationsTable,
  notificationsTable,
  activityLogTable,
  shoppingItemsTable,
  projectsTable,
  projectPlansTable,
  tradesTable,
  projectTasksTable,
  quotesTable,
  insertUserSchema,
  insertCategorySchema,
  insertLocationSchema,
  insertMaintenanceGroupSchema,
  insertTaskSchema,
  insertNoteSchema,
  insertInvitationSchema,
  insertNotificationSchema,
  insertActivityLogSchema,
  insertShoppingItemSchema,
  insertProjectSchema,
  insertProjectPlanSchema,
  insertTradeSchema,
  insertProjectTaskSchema,
  insertQuoteSchema,
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuthId(authProvider: string, authId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  verifyPassword(userId: string, password: string): Promise<boolean>;
  listUsers(): Promise<User[]>;

  // Categories
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;

  // Locations
  getLocation(id: string): Promise<Location | undefined>;
  getLocationByCode(code: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, updates: Partial<InsertLocation>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  listLocations(): Promise<Location[]>;

  // Maintenance Groups
  getMaintenanceGroup(id: string): Promise<MaintenanceGroup | undefined>;
  createMaintenanceGroup(group: InsertMaintenanceGroup): Promise<MaintenanceGroup>;
  updateMaintenanceGroup(id: string, updates: Partial<InsertMaintenanceGroup>): Promise<MaintenanceGroup>;
  deleteMaintenanceGroup(id: string): Promise<void>;
  listMaintenanceGroups(): Promise<MaintenanceGroup[]>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  listTasks(filters?: {
    locationId?: string;
    status?: string;
    assignedGroup?: string;
    assignedGroups?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Task[]>;
  listTasksByLocation(locationId: string, startDate?: Date, endDate?: Date): Promise<Task[]>;

  // Notes
  createNote(note: InsertNote): Promise<Note>;
  listNotesByTask(taskId: string): Promise<Note[]>;

  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationByEmail(email: string): Promise<Invitation | undefined>;
  getInvitationByEmailIncludingExpired(email: string): Promise<Invitation | undefined>;
  updateInvitation(id: string, updates: Partial<InsertInvitation>): Promise<Invitation>;
  markInvitationAccepted(id: string): Promise<Invitation>;
  listPendingInvitations(): Promise<Invitation[]>;
  deleteInvitation(id: string): Promise<void>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  listNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string): Promise<Notification>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Task statistics
  getRedFlagTaskCountForUser(userId: string): Promise<number>;

  // Activity Log
  createActivityLog(entry: InsertActivityLog): Promise<ActivityLog>;
  updateActivityLog(id: string, updates: Partial<InsertActivityLog>): Promise<ActivityLog>;
  deleteActivityLog(id: string): Promise<void>;
  listActivityLogs(startDate?: Date, endDate?: Date): Promise<ActivityLog[]>;

  // Get tasks resolved on a specific date
  getResolvedTasksForDate(date: Date): Promise<Task[]>;

  // Shopping Items
  createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem>;
  deleteShoppingItem(id: string): Promise<void>;
  listShoppingItems(): Promise<ShoppingItem[]>;

  // Project preparation
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listProjects(buildingId?: string): Promise<Project[]>;
  listProjectPlans(projectId: string): Promise<ProjectPlan[]>;
  createProjectPlan(plan: InsertProjectPlan): Promise<ProjectPlan>;
  deleteProjectPlan(id: string): Promise<void>;
  listTrades(): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, updates: Partial<InsertTrade>): Promise<Trade>;
  deleteTrade(id: string): Promise<void>;
  getProjectTask(id: string): Promise<ProjectTask | undefined>;
  listProjectTasks(projectId?: string): Promise<ProjectTask[]>;
  createProjectTask(task: InsertProjectTask): Promise<ProjectTask>;
  updateProjectTask(id: string, updates: Partial<InsertProjectTask>): Promise<ProjectTask>;
  deleteProjectTask(id: string): Promise<void>;
  listQuotes(projectTaskId: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.select().from(usersTable).where(sql`LOWER(${usersTable.email}) = ${normalizedEmail}`);
    return user[0];
  }

  async getUserByAuthId(authProvider: string, authId: string): Promise<User | undefined> {
    const user = await db.select().from(usersTable).where(
      and(eq(usersTable.authProvider, authProvider), eq(usersTable.authId, authId))
    );
    return user[0];
  }

  async createUser(data: InsertUser): Promise<User> {
    const validated = insertUserSchema.parse(data);
    
    // Hash password if provided
    let userData = { ...validated };
    if (validated.password) {
      const hashedPassword = await bcrypt.hash(validated.password, SALT_ROUNDS);
      userData = { ...validated, password: hashedPassword };
    }
    
    const user = await db.insert(usersTable).values(userData).returning();
    return user[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const user = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    return user[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.update(usersTable)
      .set({ password: hashedPassword })
      .where(eq(usersTable.id, userId));
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || !user.password) {
      return false;
    }
    return await bcrypt.compare(password, user.password);
  }

  async listUsers(): Promise<User[]> {
    return await db.select().from(usersTable);
  }

  // Categories
  async getCategory(id: string): Promise<Category | undefined> {
    const category = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    return category[0];
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const validated = insertCategorySchema.parse(data);
    const category = await db.insert(categoriesTable).values(validated).returning();
    return category[0];
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category> {
    const partialSchema = insertCategorySchema.partial();
    const validated = partialSchema.parse(updates);
    const category = await db.update(categoriesTable)
      .set(validated)
      .where(eq(categoriesTable.id, id))
      .returning();
    return category[0];
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  }

  async listCategories(): Promise<Category[]> {
    return await db.select().from(categoriesTable);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const location = await db.select().from(locationsTable).where(eq(locationsTable.id, id));
    return location[0];
  }

  async getLocationByCode(code: string): Promise<Location | undefined> {
    const location = await db.select().from(locationsTable).where(eq(locationsTable.code, code));
    return location[0];
  }

  async createLocation(data: InsertLocation): Promise<Location> {
    const validated = insertLocationSchema.parse(data);
    const location = await db.insert(locationsTable).values(validated).returning();
    return location[0];
  }

  async updateLocation(id: string, updates: Partial<InsertLocation>): Promise<Location> {
    const partialSchema = insertLocationSchema.partial();
    const validated = partialSchema.parse(updates);
    const location = await db.update(locationsTable)
      .set(validated)
      .where(eq(locationsTable.id, id))
      .returning();
    return location[0];
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locationsTable).where(eq(locationsTable.id, id));
  }

  async listLocations(): Promise<Location[]> {
    return await db.select().from(locationsTable).orderBy(locationsTable.category, locationsTable.name);
  }

  async getMaintenanceGroup(id: string): Promise<MaintenanceGroup | undefined> {
    const group = await db.select().from(maintenanceGroupsTable).where(eq(maintenanceGroupsTable.id, id));
    return group[0];
  }

  async createMaintenanceGroup(data: InsertMaintenanceGroup): Promise<MaintenanceGroup> {
    const validated = insertMaintenanceGroupSchema.parse(data);
    const group = await db.insert(maintenanceGroupsTable).values(validated).returning();
    return group[0];
  }

  async updateMaintenanceGroup(id: string, updates: Partial<InsertMaintenanceGroup>): Promise<MaintenanceGroup> {
    const partialSchema = insertMaintenanceGroupSchema.partial();
    const validated = partialSchema.parse(updates);
    const group = await db.update(maintenanceGroupsTable)
      .set(validated)
      .where(eq(maintenanceGroupsTable.id, id))
      .returning();
    return group[0];
  }

  async deleteMaintenanceGroup(id: string): Promise<void> {
    await db.delete(maintenanceGroupsTable).where(eq(maintenanceGroupsTable.id, id));
  }

  async listMaintenanceGroups(): Promise<MaintenanceGroup[]> {
    return await db.select().from(maintenanceGroupsTable);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const task = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    return task[0];
  }

  async createTask(data: InsertTask): Promise<Task> {
    const validated = insertTaskSchema.parse(data);
    const task = await db.insert(tasksTable).values(validated).returning();
    return task[0];
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    const task = await db.update(tasksTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();
    return task[0];
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(notesTable).where(eq(notesTable.taskId, id));
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
  }

  async listTasks(filters?: {
    locationId?: string;
    status?: string;
    assignedGroup?: string;
    assignedGroups?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Task[]> {
    const conditions = [];
    if (filters?.locationId) {
      conditions.push(eq(tasksTable.locationId, filters.locationId));
    }
    if (filters?.status) {
      conditions.push(eq(tasksTable.status, filters.status));
    }
    if (filters?.assignedGroup) {
      conditions.push(eq(tasksTable.assignedGroup, filters.assignedGroup));
    }
    if (filters?.assignedGroups) {
      conditions.push(sql`${filters.assignedGroups} = ANY(${tasksTable.assignedGroups})`);
    }
    if (filters?.startDate) {
      conditions.push(gte(tasksTable.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(tasksTable.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      const tasks = await db.select()
        .from(tasksTable)
        .where(and(...conditions))
        .orderBy(desc(tasksTable.createdAt));
      return tasks;
    }

    const tasks = await db.select()
      .from(tasksTable)
      .orderBy(desc(tasksTable.createdAt));
    return tasks;
  }

  async listTasksByLocation(locationId: string, startDate?: Date, endDate?: Date): Promise<Task[]> {
    return this.listTasks({
      locationId,
      startDate,
      endDate,
    });
  }

  async createNote(data: InsertNote): Promise<Note> {
    const validated = insertNoteSchema.parse(data);
    const note = await db.insert(notesTable).values(validated).returning();
    return note[0];
  }

  async listNotesByTask(taskId: string): Promise<Note[]> {
    const notes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.taskId, taskId))
      .orderBy(desc(notesTable.createdAt));
    return notes;
  }

  // Invitations
  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const validated = insertInvitationSchema.parse(data);
    const invitation = await db.insert(invitationsTable).values(validated).returning();
    return invitation[0];
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const invitation = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token));
    return invitation[0];
  }

  async getInvitationByEmail(email: string): Promise<Invitation | undefined> {
    const invitation = await db.select()
      .from(invitationsTable)
      .where(and(
        eq(invitationsTable.email, email),
        gte(invitationsTable.expiresAt, new Date())
      ))
      .orderBy(desc(invitationsTable.createdAt));
    return invitation[0];
  }

  async getInvitationByEmailIncludingExpired(email: string): Promise<Invitation | undefined> {
    const invitation = await db.select()
      .from(invitationsTable)
      .where(eq(invitationsTable.email, email))
      .orderBy(desc(invitationsTable.createdAt));
    return invitation[0];
  }

  async updateInvitation(id: string, updates: Partial<InsertInvitation>): Promise<Invitation> {
    const invitation = await db.update(invitationsTable)
      .set(updates)
      .where(eq(invitationsTable.id, id))
      .returning();
    return invitation[0];
  }

  async markInvitationAccepted(id: string): Promise<Invitation> {
    const invitation = await db.update(invitationsTable)
      .set({ acceptedAt: new Date() })
      .where(eq(invitationsTable.id, id))
      .returning();
    return invitation[0];
  }

  async listPendingInvitations(): Promise<Invitation[]> {
    const invitations = await db.select()
      .from(invitationsTable)
      .where(and(
        gte(invitationsTable.expiresAt, new Date())
      ))
      .orderBy(desc(invitationsTable.createdAt));
    return invitations.filter(inv => !inv.acceptedAt);
  }

  async deleteInvitation(id: string): Promise<void> {
    await db.delete(invitationsTable).where(eq(invitationsTable.id, id));
  }

  // Notification methods
  async createNotification(data: InsertNotification): Promise<Notification> {
    const validated = insertNotificationSchema.parse(data);
    const notification = await db.insert(notificationsTable).values(validated).returning();
    return notification[0];
  }

  async listNotificationsByUser(userId: string): Promise<Notification[]> {
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt));
    return notifications;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false)
      ));
    return Number(result[0]?.count || 0);
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const notification = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    return notification[0];
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, userId));
  }

  async getRedFlagTaskCountForUser(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(tasksTable)
      .where(and(
        eq(tasksTable.assignedTo, userId),
        eq(tasksTable.priority, "Red Flag"),
        sql`${tasksTable.status} != 'Resolved'`
      ));
    return Number(result[0]?.count || 0);
  }

  // Activity Log methods
  async createActivityLog(data: InsertActivityLog): Promise<ActivityLog> {
    const validated = insertActivityLogSchema.parse(data);
    const entry = await db.insert(activityLogTable).values(validated).returning();
    return entry[0];
  }

  async updateActivityLog(id: string, updates: Partial<InsertActivityLog>): Promise<ActivityLog> {
    const entry = await db.update(activityLogTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(activityLogTable.id, id))
      .returning();
    return entry[0];
  }

  async deleteActivityLog(id: string): Promise<void> {
    await db.delete(activityLogTable).where(eq(activityLogTable.id, id));
  }

  async listActivityLogs(startDate?: Date, endDate?: Date): Promise<ActivityLog[]> {
    let query = db.select().from(activityLogTable);
    
    if (startDate && endDate) {
      query = query.where(and(
        gte(activityLogTable.entryDate, startDate),
        lte(activityLogTable.entryDate, endDate)
      )) as typeof query;
    } else if (startDate) {
      query = query.where(gte(activityLogTable.entryDate, startDate)) as typeof query;
    } else if (endDate) {
      query = query.where(lte(activityLogTable.entryDate, endDate)) as typeof query;
    }
    
    return await query.orderBy(desc(activityLogTable.entryDate));
  }

  async getResolvedTasksForDate(date: Date): Promise<Task[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(tasksTable)
      .where(and(
        eq(tasksTable.status, "Resolved"),
        gte(tasksTable.updatedAt, startOfDay),
        lte(tasksTable.updatedAt, endOfDay)
      ))
      .orderBy(desc(tasksTable.updatedAt));
  }

  async createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem> {
    const validated = insertShoppingItemSchema.parse(item);
    const result = await db.insert(shoppingItemsTable).values(validated).returning();
    return result[0];
  }

  async deleteShoppingItem(id: string): Promise<void> {
    await db.delete(shoppingItemsTable).where(eq(shoppingItemsTable.id, id));
  }

  async listShoppingItems(): Promise<ShoppingItem[]> {
    return await db.select().from(shoppingItemsTable).orderBy(desc(shoppingItemsTable.createdAt));
  }

  // Project preparation
  async getProject(id: string): Promise<Project | undefined> {
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    return project[0];
  }

  async createProject(data: InsertProject): Promise<Project> {
    const validated = insertProjectSchema.parse(data);
    const project = await db.insert(projectsTable).values(validated).returning();
    return project[0];
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const validated = insertProjectSchema.partial().parse(updates);
    const project = await db.update(projectsTable)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();
    return project[0];
  }

  async deleteProject(id: string): Promise<void> {
    const tasks = await this.listProjectTasks(id);
    if (tasks.length > 0) {
      await db.delete(quotesTable).where(inArray(quotesTable.projectTaskId, tasks.map(task => task.id)));
    }
    await db.delete(projectTasksTable).where(eq(projectTasksTable.projectId, id));
    await db.delete(projectPlansTable).where(eq(projectPlansTable.projectId, id));
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
  }

  async listProjects(buildingId?: string): Promise<Project[]> {
    const query = db.select().from(projectsTable);
    if (buildingId) {
      return await query.where(eq(projectsTable.buildingId, buildingId)).orderBy(desc(projectsTable.createdAt));
    }
    return await query.orderBy(desc(projectsTable.createdAt));
  }

  async listProjectPlans(projectId: string): Promise<ProjectPlan[]> {
    return await db.select().from(projectPlansTable)
      .where(eq(projectPlansTable.projectId, projectId))
      .orderBy(desc(projectPlansTable.createdAt));
  }

  async createProjectPlan(data: InsertProjectPlan): Promise<ProjectPlan> {
    const validated = insertProjectPlanSchema.parse(data);
    const plan = await db.insert(projectPlansTable).values(validated).returning();
    return plan[0];
  }

  async deleteProjectPlan(id: string): Promise<void> {
    await db.delete(projectPlansTable).where(eq(projectPlansTable.id, id));
  }

  async listTrades(): Promise<Trade[]> {
    return await db.select().from(tradesTable).orderBy(tradesTable.name);
  }

  async createTrade(data: InsertTrade): Promise<Trade> {
    const validated = insertTradeSchema.parse(data);
    const trade = await db.insert(tradesTable).values(validated).returning();
    return trade[0];
  }

  async updateTrade(id: string, updates: Partial<InsertTrade>): Promise<Trade> {
    const validated = insertTradeSchema.partial().parse(updates);
    const trade = await db.update(tradesTable).set(validated).where(eq(tradesTable.id, id)).returning();
    return trade[0];
  }

  async deleteTrade(id: string): Promise<void> {
    await db.update(projectTasksTable).set({ tradeId: null }).where(eq(projectTasksTable.tradeId, id));
    await db.delete(tradesTable).where(eq(tradesTable.id, id));
  }

  async getProjectTask(id: string): Promise<ProjectTask | undefined> {
    const task = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, id));
    return task[0];
  }

  async listProjectTasks(projectId?: string): Promise<ProjectTask[]> {
    const query = db.select().from(projectTasksTable);
    if (projectId) {
      return await query.where(eq(projectTasksTable.projectId, projectId)).orderBy(desc(projectTasksTable.createdAt));
    }
    return await query.orderBy(desc(projectTasksTable.createdAt));
  }

  async createProjectTask(data: InsertProjectTask): Promise<ProjectTask> {
    const validated = insertProjectTaskSchema.parse(data);
    const task = await db.insert(projectTasksTable).values(validated).returning();
    return task[0];
  }

  async updateProjectTask(id: string, updates: Partial<InsertProjectTask>): Promise<ProjectTask> {
    const validated = insertProjectTaskSchema.partial().parse(updates);
    const task = await db.update(projectTasksTable)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(projectTasksTable.id, id))
      .returning();
    return task[0];
  }

  async deleteProjectTask(id: string): Promise<void> {
    await db.delete(quotesTable).where(eq(quotesTable.projectTaskId, id));
    await db.delete(projectTasksTable).where(eq(projectTasksTable.id, id));
  }

  async listQuotes(projectTaskId: string): Promise<Quote[]> {
    return await db.select().from(quotesTable)
      .where(eq(quotesTable.projectTaskId, projectTaskId))
      .orderBy(quotesTable.amount);
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const quote = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    return quote[0];
  }

  async createQuote(data: InsertQuote): Promise<Quote> {
    const validated = insertQuoteSchema.parse(data);
    const quote = await db.insert(quotesTable).values(validated).returning();
    return quote[0];
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote> {
    const validated = insertQuoteSchema.partial().parse(updates);
    const quote = await db.update(quotesTable)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(quotesTable.id, id))
      .returning();
    return quote[0];
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotesTable).where(eq(quotesTable.id, id));
  }
}

export const storage = new PostgresStorage();
