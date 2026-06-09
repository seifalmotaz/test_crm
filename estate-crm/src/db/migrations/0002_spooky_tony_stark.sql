ALTER TABLE "properties" ALTER COLUMN "attributes" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "attributes" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_properties_tenant_status_created" ON "properties" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_properties_tenant_project" ON "properties" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_properties_tenant_type_price" ON "properties" USING btree ("tenant_id","type","price");--> statement-breakpoint
CREATE INDEX "idx_properties_attributes" ON "properties" USING btree ("attributes");