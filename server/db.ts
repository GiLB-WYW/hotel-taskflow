import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL,
});

export const db = drizzle(pool);
