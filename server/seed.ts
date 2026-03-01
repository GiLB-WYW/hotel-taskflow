import { db } from "./db";
import { usersTable, locationsTable, maintenanceGroupsTable, tasksTable, categoriesTable } from "@shared/schema";

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // Clear existing data
    await db.delete(tasksTable);
    await db.delete(maintenanceGroupsTable);
    await db.delete(locationsTable);
    await db.delete(categoriesTable);
    await db.delete(usersTable);

    // Seed users with hashed passwords
    const bcrypt = await import("bcrypt");
    const TEMP_PASSWORD = "Welcome123!"; // Temporary password for all admin users
    const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

    const users = await db
      .insert(usersTable)
      .values([
        {
          name: "Gilles",
          email: "gilles@toileblanche.com",
          password: hashedPassword,
          role: "Admin",
          authProvider: "email",
          avatar: "GL",
        },
        {
          name: "Nicolas",
          email: "nicolas@toileblanche.com",
          password: hashedPassword,
          role: "Admin",
          authProvider: "email",
          avatar: "NI",
        },
        {
          name: "Gregory",
          email: "gregory@toileblanche.com",
          password: hashedPassword,
          role: "Admin",
          authProvider: "email",
          avatar: "GR",
        },
        {
          name: "Jean Dupont",
          email: "jean@hotel.com",
          role: "Admin",
          authProvider: "email",
          avatar: "JD",
        },
        {
          name: "Marie Curie",
          email: "marie@hotel.com",
          role: "Manager",
          authProvider: "email",
          avatar: "MC",
        },
        {
          name: "Paul Plombier",
          email: "paul@hotel.com",
          role: "Personnel",
          authProvider: "email",
          avatar: "PP",
        },
        {
          name: "Basic Staff 1",
          email: "staff@hotel.com",
          role: "Basic Staff",
          authProvider: "email",
          avatar: "BS",
        },
      ])
      .returning();

    console.log("✅ Admin users created:");
    console.log("  - gilles@toileblanche.com (password: Welcome123!)");
    console.log("  - nicolas@toileblanche.com (password: Welcome123!)");
    console.log("  - gregory@toileblanche.com (password: Welcome123!)");

    // Seed categories
    await db
      .insert(categoriesTable)
      .values([
        { name: "Restaurant", description: "Restaurant and dining areas" },
        { name: "Suites B", description: "Suites in Building B" },
        { name: "Suites C", description: "Suites in Building C" },
        { name: "Technical", description: "Technical and maintenance areas" },
        { name: "Pool Machinery", description: "Pool equipment and machinery" },
        { name: "Building A", description: "Building A rooms and areas" },
        { name: "Building D", description: "Building D rooms and areas" },
        { name: "Building E", description: "Building E rooms and areas" },
        { name: "Building F", description: "Building F rooms and areas" },
        { name: "Building G", description: "Building G rooms and areas" },
      ])
      .returning();
    console.log("✅ Categories seeded");

    // Seed locations
    const locations = await db
      .insert(locationsTable)
      .values([
        { name: "Le Restaurant", category: "Restaurant", code: "R1" },
        { name: "Prive 1", category: "Restaurant", code: "PR1" },
        { name: "Prive 2", category: "Restaurant", code: "PR2" },
        { name: "Cuisine Le Restaurant", category: "Restaurant", code: "CUI1" },
        { name: "Suite B1", category: "Suites B", code: "B1" },
        { name: "Suite B2", category: "Suites B", code: "B2" },
        { name: "Suite B3", category: "Suites B", code: "B3" },
        { name: "Suite C1", category: "Suites C", code: "C1" },
        { name: "Suite C2", category: "Suites C", code: "C2" },
        { name: "La Réception", category: "Technical", code: "REC" },
        { name: "Laverie B", category: "Technical", code: "LAV" },
        { name: "Cave à Vin", category: "Technical", code: "CAVE" },
        { name: "Machine Piscine C", category: "Pool Machinery", code: "POOL" },
      ])
      .returning();

    // Seed maintenance groups
    const groups = await db
      .insert(maintenanceGroupsTable)
      .values([
        { name: "Plomberie", description: "Plumbing & Water Systems", memberCount: 3 },
        { name: "Électricité", description: "Electrical & Power Systems", memberCount: 2 },
        { name: "Ménage", description: "Cleaning & Housekeeping", memberCount: 5 },
        { name: "Général", description: "General Maintenance", memberCount: 4 },
        { name: "Piscine", description: "Pool & Sauna Maintenance", memberCount: 2 },
        { name: "SMTR team", description: "SMTR Maintenance Team", memberCount: 0 },
      ])
      .returning();

    // Seed tasks
    await db
      .insert(tasksTable)
      .values([
        {
          title: "Water Leak in Suite B1",
          description: "Major water leak in the bathroom sink. Water is flooding the floor.",
          locationId: locations[4].id,
          priority: "Red Flag",
          status: "Open",
          assignedGroup: groups[0].id,
          assignedGroups: [groups[0].id],
          createdBy: users[3].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
          imageUrl: "https://images.unsplash.com/photo-1585909696425-6408252a5f63?auto=format&fit=crop&q=80&w=600",
        },
        {
          title: "AC Filter Cleaning",
          description: "Routine cleaning of AC filters in the restaurant area.",
          locationId: locations[0].id,
          priority: "Normal",
          status: "In Progress",
          assignedTo: users[2].id,
          assignedGroup: groups[3].id,
          assignedGroups: [groups[3].id],
          createdBy: users[1].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
        {
          title: "Broken Light Switch",
          description: "Light switch near the entrance is stuck.",
          locationId: locations[9].id,
          priority: "High",
          status: "Open",
          assignedGroup: groups[1].id,
          assignedGroups: [groups[1].id],
          createdBy: users[3].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
          title: "Carpet Stain in Suite C2",
          description: "Wine stain on the carpet near the window. Needs professional cleaning.",
          locationId: locations[8].id,
          priority: "Normal",
          status: "Resolved",
          assignedGroup: groups[2].id,
          assignedGroups: [groups[2].id],
          createdBy: users[0].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        },
        {
          title: "Pool Temperature Control",
          description: "Pool temperature is not maintaining at 28°C. Check heating system.",
          locationId: locations[12].id,
          priority: "High",
          status: "In Progress",
          assignedTo: users[2].id,
          assignedGroup: groups[4].id,
          assignedGroups: [groups[4].id],
          createdBy: users[1].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        },
        {
          title: "Restaurant Door Hinge",
          description: "Main entrance door hinge is loose and creaking.",
          locationId: locations[0].id,
          priority: "Normal",
          status: "Open",
          assignedGroup: groups[3].id,
          assignedGroups: [groups[3].id],
          createdBy: users[3].id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
        },
      ]);

    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
