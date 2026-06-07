# Phase 5: Projects & Properties

## Goal
Implement Project and Property entities with status FSM, polymorphic JSONB attributes with Zod validation, media support via S3 pre-signed URLs, and proper indexing.

## Why This Phase Fifth
Properties are the inventory. Leads and deals revolve around properties. Without properties, the sales pipeline has nothing to sell.

---

## File Manifest

- `src/modules/projects/projects.module.ts`
- `src/modules/projects/dto/create-project.dto.ts`
- `src/modules/projects/dto/update-project.dto.ts`
- `src/modules/projects/projects.service.ts`
- `src/modules/projects/projects.controller.ts`
- `src/modules/projects/tests/projects.service.spec.ts`
- `src/modules/properties/properties.module.ts`
- `src/modules/properties/dto/create-property.dto.ts`
- `src/modules/properties/dto/update-property.dto.ts`
- `src/modules/properties/dto/property-attributes.dto.ts` — Zod schemas
- `src/modules/properties/enums/property-type.enum.ts`
- `src/modules/properties/enums/property-status.enum.ts`
- `src/modules/properties/properties.service.ts`
- `src/modules/properties/properties.controller.ts`
- `src/modules/properties/tests/properties.service.spec.ts`
- `src/modules/chat/chat.module.ts`
- `src/modules/chat/dto/create-conversation.dto.ts`
- `src/modules/chat/dto/send-message.dto.ts`
- `src/modules/chat/enums/conversation-type.enum.ts`
- `src/modules/chat/enums/message-type.enum.ts`
- `src/modules/chat/chat.service.ts`
- `src/modules/chat/chat.controller.ts`
- `src/modules/chat/tests/chat.service.spec.ts`

---

## Task Breakdown

### 5.1 Projects Schema

```typescript
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 255 }),
  developerName: varchar('developer_name', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('planning'),
  launchDate: date('launch_date'),
  completionDate: date('completion_date'),
  totalUnits: integer('total_units'),
  soldUnits: integer('sold_units').default(0),
  commissionPlanId: uuid('commission_plan_id'),
  createdAt, updatedAt, deletedAt,
});
```

### 5.2 Properties Schema

```typescript
export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  projectId: uuid('project_id'),
  title: varchar('title', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  price: integer('price').notNull(), // cents
  beds: integer('beds'),
  baths: integer('baths'),
  sqft: integer('sqft'),
  yearBuilt: integer('year_built'),
  attributes: jsonb('attributes').notNull().default({}),
  images: text('images').array(),
  videos: text('videos').array(),
  agentId: uuid('agent_id'),
  commissionPlanId: uuid('commission_plan_id'),
  createdAt, updatedAt, deletedAt,
});
```

### 5.3 Zod Attribute Schemas

`src/modules/properties/dto/property-attributes.dto.ts`:

```typescript
export const ApartmentAttributesSchema = z.object({
  floor: z.number().int().positive(),
  totalFloors: z.number().int().positive(),
  hasElevator: z.boolean(),
  maintenanceFee: z.number().int().nonnegative(),
  amenities: z.array(z.string()),
  parkingSpots: z.number().int().nonnegative(),
});

export const VillaAttributesSchema = z.object({
  plotSize: z.number().positive(),
  gardenArea: z.number().nonnegative(),
  floors: z.number().int().positive(),
  hasPool: z.boolean(),
  hasGarden: z.boolean(),
  parkingSpots: z.number().int().nonnegative(),
});

export const CommercialAttributesSchema = z.object({
  frontage: z.number().positive(),
  ceilingHeight: z.number().positive(),
  licenseType: z.string(),
  footTraffic: z.enum(['low', 'medium', 'high']),
  utilities: z.array(z.string()),
});

export const LandAttributesSchema = z.object({
  zoningType: z.string(),
  buildableArea: z.number().positive(),
  roadAccess: z.boolean(),
  utilitiesAvailable: z.array(z.string()),
  topography: z.enum(['flat', 'sloped', 'hilly']),
});

export const TownhouseAttributesSchema = z.object({
  plotSize: z.number().positive(),
  sharedWalls: z.number().int().nonnegative(),
  floors: z.number().int().positive(),
  hasGarden: z.boolean(),
  parkingSpots: z.number().int().nonnegative(),
});

export const PropertyAttributesSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('apartment'), ...ApartmentAttributesSchema.shape }),
  z.object({ type: z.literal('villa'), ...VillaAttributesSchema.shape }),
  z.object({ type: z.literal('commercial'), ...CommercialAttributesSchema.shape }),
  z.object({ type: z.literal('land'), ...LandAttributesSchema.shape }),
  z.object({ type: z.literal('townhouse'), ...TownhouseAttributesSchema.shape }),
]);
```

### 5.4 Validation Service

```typescript
export function validatePropertyAttributes(
  type: PropertyType,
  attributes: unknown,
): PropertyAttributes {
  const schemaMap = {
    apartment: ApartmentAttributesSchema,
    villa: VillaAttributesSchema,
    commercial: CommercialAttributesSchema,
    land: LandAttributesSchema,
    townhouse: TownhouseAttributesSchema,
  };
  
  const result = schemaMap[type].safeParse(attributes);
  if (!result.success) {
    throw new ValidationError('VALIDATION_ERROR', 'Invalid attributes for property type', result.error.format());
  }
  
  return { type, ...result.data } as PropertyAttributes;
}
```

### 5.5 Status FSM

**Project Status:**
- `planning → preLaunch ✓`
- `planning → active ✓`
- `preLaunch → active ✓`
- `preLaunch → planning ✓`
- `active → soldOut ✓`
- `active → delivered ✓`
- `soldOut → delivered ✓`
- `delivered` terminal

**Property Status:**
- `active → pending ✓`
- `active → withdrawn ✓`
- `active → sold ✗` (must go through pending)
- `pending → sold ✓`
- `pending → active ✓`
- `withdrawn → active ✓`
- `sold` terminal

### 5.6 S3 Media Upload

```typescript
// In PropertiesService
async getPresignedUploadUrl(
  propertyId: string,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const key = `properties/${propertyId}/${Date.now()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: this.config.s3Bucket,
    Key: key,
    ContentType: contentType,
  });
  
  const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  const fileUrl = `https://${this.config.s3Bucket}.s3.${this.config.s3Region}.amazonaws.com/${key}`;
  
  return { uploadUrl, fileUrl };
}
```

Client uploads directly to S3, then PATCHes property with `images` or `videos` array.

### 5.7 Database Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_properties_tenant_status_created ON properties(tenant_id, status, created_at DESC);
CREATE INDEX idx_properties_tenant_project ON properties(tenant_id, project_id);
CREATE INDEX idx_properties_tenant_type_price ON properties(tenant_id, type, price);

-- GIN index for JSONB attributes
CREATE INDEX idx_properties_attributes ON properties USING GIN (attributes);

-- Text search on title/address
CREATE INDEX idx_properties_search ON properties USING gin(to_tsvector('english', title || ' ' || COALESCE(address, '')));
```

### 5.8 Integration Tests

```typescript
describe('Properties', () => {
  it('should create apartment with valid attributes', async () => {
    // POST /api/properties with type apartment and valid attributes
    // Assert 201
    // Assert attributes stored correctly
  });
  
  it('should reject apartment with missing floor', async () => {
    // POST /api/properties with type apartment, missing floor
    // Assert 400 VALIDATION_ERROR
  });
  
  it('should transition property status active → pending', async () => {
    // Create active property
    // POST /api/properties/:id/status { status: 'pending' }
    // Assert 200
  });
  
  it('should reject active → sold direct transition', async () => {
    // POST /api/properties/:id/status { status: 'sold' }
    // Assert 400 PROPERTY_STATUS_CONFLICT
  });
  
  it('should return pre-signed URL for media upload', async () => {
    // POST /api/properties/:id/media
    // Assert uploadUrl and fileUrl present
  });
});
```

---

## Dependencies
- Phase 4 (Users exist to be assigned as agents)

## Verification

- [ ] Creating property with valid attributes succeeds and stores JSONB
- [ ] Creating property with invalid attributes returns `VALIDATION_ERROR`
- [ ] Property status transitions follow FSM rules
- [ ] Direct `active → sold` transition rejected
- [ ] Media upload returns S3 pre-signed PUT URL
- [ ] Property list queries use indexes and perform well
- [ ] Soft-deleted properties excluded from list by default

## Risks

| Risk | Mitigation |
|------|-----------|
| JSONB validation bypassed | Never accept raw attributes from request without Zod validation |
| S3 pre-signed URL expiration | 5-minute expiry is documented; client must upload immediately |
| Large image arrays on property | Limit to 50 images per property; paginate if needed |
