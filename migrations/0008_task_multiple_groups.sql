ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "assigned_groups" text[];
--> statement-breakpoint
UPDATE "tasks"
SET "assigned_groups" = ARRAY["assigned_group"]
WHERE "assigned_groups" IS NULL
  AND "assigned_group" IS NOT NULL
  AND btrim("assigned_group") <> '';