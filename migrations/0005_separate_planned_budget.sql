-- Preserve the visible planned amounts from the former unit-price × quantity
-- calculation before budgets are treated as an independent field.
UPDATE "project_tasks"
SET "estimated_cost" = ROUND("unit_price" * "quantity", 2)
WHERE "unit_price" IS NOT NULL
  AND "quantity" IS NOT NULL
  AND "unit_price" > 0
  AND "quantity" > 0;