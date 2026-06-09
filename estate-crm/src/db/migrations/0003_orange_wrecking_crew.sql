-- Drop the now-unused `clients` table and its dependent columns.
-- CASCADE on the table drop handles the foreign keys from `deals.client_id` and `leads.converted_to_client_id`.
-- After the CASCADE, the columns themselves remain (they're nullable with no NOT NULL constraint) so we drop them explicitly.
DROP TABLE "clients" CASCADE;--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN IF EXISTS "client_id";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_to_client_id";