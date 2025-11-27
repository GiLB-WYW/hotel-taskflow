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
  usersTable,
  categoriesTable,
  locationsTable,
  maintenanceGroupsTable,
  tasksTable,
  notesTable,
  invitationsTable,
  insertUserSchema,
  insertCategorySchema,
  insertLocationSchema,
  insertMaintenanceGroupSchema,
  insertTaskSchema,
  insertNoteSchema,
  insertInvitationSchema,
} from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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
  listTasks(filters?: {
    locationId?: string;
    status?: string;
    assignedGroup?: string;
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
  markInvitationAccepted(id: string): Promise<Invitation>;
  listPendingInvitations(): Promise<Invitation[]>;
  deleteInvitation(id: string): Promise<void>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await db.select().from(usersTable).where(eq(usersTable.email, email));
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
    return await db.select().from(locationsTable);
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

  async listTasks(filters?: {
    locationId?: string;
    status?: string;
    assignedGroup?: string;
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
}

export const storage = new PostgresStorage();
