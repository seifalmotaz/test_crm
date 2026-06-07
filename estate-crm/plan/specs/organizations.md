# Organizations Module Specification

## Purpose
Manages real estate brokerage Organizations (tenants). Provides super admin endpoints for Organization lifecycle and tenant endpoints for Organization self-management.

## Data Model

### Database Tables

**organizations** (base entity, no soft delete — super admin hard deletes):
- `id`: UUIDv7 PK
- `name`: String
- `slug`: String, unique across platform
- `status`: Enum [active, suspended, inactive]
- `plan`: Enum [basic, pro, enterprise]
- `settings`: JSONB (custom config per org)
- `createdAt`, `updatedAt`

## API Endpoints

### Tenant-Scoped (requires tenant auth)

#### GET /api/organizations/me
**Success 200:**
```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "status": "active",
  "plan": "pro",
  "settings": {},
  "createdAt": "2024-01-01T00:00:00Z",
  "userCount": 12
}
```

**Errors:**
- `401 UNAUTHORIZED` — Not authenticated
- `403 TENANT_SUSPENDED` — Organization suspended

### Super Admin (requires superAdmin flag)

#### GET /api/admin/organizations
**Query:** `?status=active&suspended&plan=pro&page=1&limit=20`

**Success 200:** Paginated list of all organizations with user counts.

#### POST /api/admin/organizations
**Request Body:**
```json
{
  "name": "Sunset Realty",
  "slug": "sunset-realty",
  "plan": "pro",
  "adminEmail": "admin@sunset.com",
  "adminName": "John Smith",
  "adminPassword": "temp123!" // Temporary, must change on first login
}
```

**Success 201:** Created organization with initial admin user.

**Errors:**
- `400 VALIDATION_ERROR` — Missing required fields
- `409 SLUG_EXISTS` — Slug already taken
- `409 EMAIL_EXISTS` — Admin email already in use

#### GET /api/admin/organizations/:id
**Success 200:** Organization details with users list.

#### PATCH /api/admin/organizations/:id
**Request Body:**
```json
{
  "name": "string",
  "status": "suspended",
  "plan": "enterprise",
  "settings": {}
}
```

**Success 200:** Updated organization.

**Errors:**
- `404 ORGANIZATION_NOT_FOUND`
- `403 FORBIDDEN` — Not super admin

#### DELETE /api/admin/organizations/:id
**Success 204:** Hard deleted organization and all tenant data.

**Errors:**
- `404 ORGANIZATION_NOT_FOUND`
- `403 FORBIDDEN`

#### POST /api/admin/organizations/:id/activate
**Success 200:** Sets status to `active`.

#### POST /api/admin/organizations/:id/suspend
**Success 200:** Sets status to `suspended`.

## Business Rules

1. Slug must be URL-safe and unique across the platform
2. Only super admin can create, suspend, or delete Organizations
3. Suspending an Organization blocks all tenant-scoped API requests
4. Organization settings is a JSONB blob for extensibility (feature flags, custom fields)
5. One Organization must have exactly one default Commission Plan
6. Deleting an Organization is irreversible and cascades to all tenant data

## Error Codes

| Code | Status | When |
|------|--------|------|
| ORGANIZATION_NOT_FOUND | 404 | ID doesn't exist |
| SLUG_EXISTS | 409 | Slug already in use |
| EMAIL_EXISTS | 409 | Admin email already exists |
| FORBIDDEN | 403 | Non-super admin accessing admin endpoints |
| TENANT_SUSPENDED | 403 | Organization is suspended |

## OpenAPI Notes
- Super admin endpoints tagged as `Super Admin`
- Tenant endpoints tagged as `Organization`
- All super admin endpoints require `@ApiBearerAuth()` and `@Roles('superAdmin')`
