ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "mobile_phone" text,
  ADD COLUMN IF NOT EXISTS "email" text,
  ADD COLUMN IF NOT EXISTS "website" text,
  ADD COLUMN IF NOT EXISTS "siret" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_trades" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_id" varchar NOT NULL REFERENCES "suppliers"("id") ON DELETE cascade,
  "trade_id" varchar NOT NULL REFERENCES "trades"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_trades_supplier_trade_unique"
  ON "supplier_trades" ("supplier_id", "trade_id");