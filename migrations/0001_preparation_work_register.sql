ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "category" varchar DEFAULT 'General works' NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "source_task_id" varchar;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_source_task_id_tasks_id_fk'
  ) THEN
    ALTER TABLE "project_tasks"
      ADD CONSTRAINT "project_tasks_source_task_id_tasks_id_fk"
      FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_tasks_source_task_id_unique"
  ON "project_tasks" ("source_task_id")
  WHERE "source_task_id" IS NOT NULL;