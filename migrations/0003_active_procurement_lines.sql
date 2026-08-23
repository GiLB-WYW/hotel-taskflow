ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;