# Phase 3: Organizations (Tenants) & Super Admin

## Goal
Implement the Organization entity and super admin endpoints. This is the foundation for multi-tenancy — without Organizations, no users, properties, or data can exist.

## Why This Phase Third
Users belong to Organizations. All tenant-scoped data requires an Organization to exist first. The super admin endpoints are the entry point for the entire system.

---

## File Manifest

- `src/modules/organizations/organizations.module.ts`
- `src/modules/organizations/dto/create-organization.dto.ts`
- `src/modules/organizations/dto/update-organization.dto.ts`
- `src/modules/organizations/organizations.service.ts`
- `src/modules/organizations/organizations.controller.ts` — Tenant self-management
- `src/modules/organizations/organizations-admin.controller.ts` — Super admin CRUD
- `src/modules/organizations/tests/organizations.service.spec.ts`

---

## Task Breakdown

### 3.1 Organizations Schema

The `organizations` table is special — no `tenantId` (it IS the tenant), no soft delete (super admin hard deletes):

```typescript
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  plan: varchar('plan', { length: 20 }).notNull().default('basic'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.2 DTOs

**CreateOrganizationDto:**
```typescript
export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;
  
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be URL-safe' })
  slug: string;
  
  @IsEnum(['basic', 'pro', 'enterprise'])
  plan: string = 'basic';
  
  // Initial admin user
  @IsEmail()
  adminEmail: string;
  
  @IsString()
  @MinLength(2)
  adminName: string;
  
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
```

**UpdateOrganizationDto:**
Partial of CreateOrganizationDto, excluding admin fields.

### 3.3 Service

`OrganizationsService` methods:
- `create(dto: CreateOrganizationDto)` — Create org + initial admin user in transaction
- `findById(id: string)` — Get organization
- `findAll(filters: OrganizationFilters)` — List with pagination
- `update(id: string, dto: UpdateOrganizationDto)` — Update fields
- `delete(id: string)` — Hard delete (cascades to all tenant data)
- `activate(id: string)` — Set status to active
- `suspend(id: string)` — Set status to suspended

**Business Rules:**
1. Slug must be URL-safe and unique across platform
2. Creating an organization also creates the first admin user in a transaction
3. One default commission plan should be created for the organization (or seed data provides it)
4. Deleting an organization is irreversible and cascades to all tenant data

### 3.4 Tenant Controller

`OrganizationsController` (tenant-scoped, requires auth):
- `GET /api/organizations/me` — Current organization details with user count

Returns:
```json
{
  "id": "uuid",
  "name": "Sunset Realty",
  "slug": "sunset-realty",
  "status": "active",
  "plan": "pro",
  "settings": {},
  "createdAt": "2024-01-01T00:00:00Z",
  "userCount": 12
}
```

### 3.5 Super Admin Controller

`OrganizationsAdminController` (requires `SuperAdminGuard`):
- `GET /api/admin/organizations` — List all orgs (filter by status, plan)
- `POST /api/admin/organizations` — Create org with initial admin
- `GET /api/admin/organizations/:id` — Get org with users
- `PATCH /api/admin/organizations/:id` — Update org
- `DELETE /api/admin/organizations/:id` — Hard delete
- `POST /api/admin/organizations/:id/activate` — Activate
- `POST /api/admin/organizations/:id/suspend` — Suspend

### 3.6 Seed Script Update

Update `src/db/seed.ts` to create:
1. A test organization with slug `test-brokerage`
2. An admin user for the test org
3. A default commission plan

### 3.7 Integration Tests

```typescript
describe('Organizations', () => {
  it('should create organization and admin user', async () => {
    // POST /api/admin/organizations
    // Assert org created
    // Assert admin user exists with correct role
  });
  
  it('should reject duplicate slug', async () => {
    // Create org with slug 'test'
    // Try create another with same slug
    // Assert 409 with SLUG_EXISTS
  });
  
  it('should suspend organization and block tenant requests', async () => {
    // Suspend org
    // Try login as tenant user
    // Assert TENANT_SUSPENDED
  });
  
  it('should reject non-super-admin accessing admin endpoints', async () => {
    // Login as tenant admin
    // GET /api/admin/organizations
    // Assert 403 FORBIDDEN
  });
});
```

---

## Dependencies
- Phase 2 (Auth, guards, error system)

## Verification

- [ ] Super admin can create organization and first admin user in one call
- [ ] Slug uniqueness enforced across platform
- [ ] Tenant admin can view their organization details at `/api/organizations/me`
- [ ] Suspending organization blocks all tenant API requests with `TENANT_SUSPENDED`
- [ ] Reactivating suspended organization restores access
- [ ] Non-super admin cannot access `/api/admin/*` endpoints
- [ ] Deleting organization removes all related data (cascading)
- [ ] Seed script creates test organization and admin user

## Risks

| Risk | Mitigation |
|------|-----------|
| Transaction failure during org + admin creation | Use Drizzle transaction, rollback on error |
| Slug collision in high concurrency | Database unique constraint handles this |
| Cascade delete performance on large tenants | Document that delete is async/batch for large tenants in v2 |
