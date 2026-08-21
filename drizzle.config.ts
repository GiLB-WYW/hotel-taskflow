import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  throw new Error("DATABASE_URL or NEON_DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL)!,
  },
});
