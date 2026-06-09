-- Add tenant_id to lead_tags (backfilled from leads)
ALTER TABLE "lead_tags" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "lead_tags" SET "tenant_id" = "leads"."tenant_id" FROM "leads" WHERE "lead_tags"."lead_id" = "leads"."id";--> statement-breakpoint
ALTER TABLE "lead_tags" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_tags_tenant_lead_idx" ON "lead_tags" USING btree ("tenant_id","lead_id");--> statement-breakpoint

-- Add tenant_id to lead_documents (backfilled from leads)
ALTER TABLE "lead_documents" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "lead_documents" SET "tenant_id" = "leads"."tenant_id" FROM "leads" WHERE "lead_documents"."lead_id" = "leads"."id";--> statement-breakpoint
ALTER TABLE "lead_documents" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_documents_tenant_lead_idx" ON "lead_documents" USING btree ("tenant_id","lead_id");--> statement-breakpoint

-- Composite indexes for query performance
CREATE INDEX "activities_tenant_entity_idx" ON "activities" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "leads_tenant_agent_idx" ON "leads" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_stage_agent_idx" ON "leads" USING btree ("tenant_id","stage","agent_id");