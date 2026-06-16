-- Replace is_converted with is_client
ALTER TABLE "leads" ADD COLUMN "is_client" boolean DEFAULT false;
UPDATE "leads" SET "is_client" = "is_converted";
ALTER TABLE "leads" DROP COLUMN "is_converted";

-- Add VIP fields
ALTER TABLE "leads" ADD COLUMN "is_vip" boolean DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "vip_set_by_id" uuid REFERENCES "users"("id");
ALTER TABLE "leads" ADD COLUMN "vip_set_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN "lifetime_value" integer DEFAULT 0;
