ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "product_description" text,
  ADD COLUMN IF NOT EXISTS "supplier_name" text,
  ADD COLUMN IF NOT EXISTS "unit_price" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "quantity" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "planned_for" varchar,
  ADD COLUMN IF NOT EXISTS "source_document" text,
  ADD COLUMN IF NOT EXISTS "source_reference" varchar,
  ADD COLUMN IF NOT EXISTS "invoice_number" varchar,
  ADD COLUMN IF NOT EXISTS "invoice_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "invoice_file_name" text,
  ADD COLUMN IF NOT EXISTS "invoice_file_url" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_tasks_source_reference_unique"
  ON "project_tasks" ("source_reference")
  WHERE "source_reference" IS NOT NULL;