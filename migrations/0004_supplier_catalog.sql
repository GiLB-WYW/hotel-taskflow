CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_group_suppliers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "maintenance_group_id" varchar NOT NULL REFERENCES "maintenance_groups"("id") ON DELETE cascade,
  "supplier_id" varchar NOT NULL REFERENCES "suppliers"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_group_suppliers_group_supplier_unique"
  ON "maintenance_group_suppliers" ("maintenance_group_id", "supplier_id");
--> statement-breakpoint
INSERT INTO "suppliers" ("name")
SELECT DISTINCT btrim("supplier_name")
FROM "project_tasks"
WHERE "supplier_name" IS NOT NULL AND btrim("supplier_name") <> ''
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "suppliers" ("name")
SELECT DISTINCT btrim("supplier_name")
FROM "quotes"
WHERE btrim("supplier_name") <> ''
ON CONFLICT ("name") DO NOTHING;