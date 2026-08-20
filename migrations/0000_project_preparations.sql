CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "building_id" varchar NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" varchar DEFAULT 'Planning' NOT NULL,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "projects_building_id_locations_id_fk"
    FOREIGN KEY ("building_id") REFERENCES "locations"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trades" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trades_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_plans" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "project_plans_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_tasks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar NOT NULL,
  "trade_id" varchar,
  "title" text NOT NULL,
  "description" text,
  "status" varchar DEFAULT 'Planned' NOT NULL,
  "estimated_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "actual_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "project_tasks_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "project_tasks_trade_id_trades_id_fk"
    FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL,
  CONSTRAINT "project_tasks_estimated_cost_nonnegative" CHECK ("estimated_cost" >= 0),
  CONSTRAINT "project_tasks_actual_cost_nonnegative" CHECK ("actual_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_task_id" varchar NOT NULL,
  "supplier_name" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "file_name" text,
  "file_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "quotes_project_task_id_project_tasks_id_fk"
    FOREIGN KEY ("project_task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "quotes_amount_nonnegative" CHECK ("amount" >= 0)
);