# Clients Module Specification

## Purpose
Manages direct client relationships that bypass the lead pipeline. Supports VIP management and manual lead conversion linkage.

## Data Model

### Database Tables

**clients** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `name`: String
- `email`: String, nullable
- `phone`: String
- `type`: Enum [buyer, seller, investor, renter, both]
- `isVip`: Boolean, default false
- `vipSetById`: UUIDv7 FK, nullable
- `vipSetAt`: Timestamp, nullable
- `lifetimeValue`: Decimal (cents), default 0
- `agentId`: UUIDv7 FK
- `convertedFromLeadId`: UUIDv7 FK, nullable
- `notes`: String, nullable
- `createdAt`, `updatedAt`, `deletedAt`

## API Endpoints

#### GET /api/clients
**Query:** `?type=buyer&isVip=true&agentId=uuid&search=john&page=1&limit=20`

**Success 200:** Paginated client list.
- Agent: sees only own clients
- Manager: sees team clients
- Admin: sees all

#### POST /api/clients
**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+971509876543",
  "type": "buyer",
  "notes": "Referred by existing client",
  "agentId": "uuid"
}
```

**Duplicate Detection:**
- Check if phone or email matches existing Lead
- If match found: return warning in response but allow creation
- Warning format: `{ warning: { type: 'DUPLICATE_LEAD', leadId: 'uuid', message: '...' } }`

**Success 201:** Created client (with optional warning).

#### GET /api/clients/:id
**Success 200:** Client with deal history and linked lead (if converted).

#### PATCH /api/clients/:id
**Request Body:** Partial fields.

#### POST /api/clients/:id/vip
**Request Body:**
```json
{ "isVip": true }
```

**Business Rules:**
- Only Manager or Admin can toggle VIP
- Sets `vipSetById` to current user
- Sets `vipSetAt` to now
- Removing VIP clears both fields

**Errors:**
- `403 FORBIDDEN` — Agent trying to set VIP

#### GET /api/clients/:id/leads
**Success 200:** Linked lead history if `convertedFromLeadId` exists.

## Business Rules

1. Clients can be created directly by any Agent (bypass lead pipeline)
2. Duplicate detection suggests linking but doesn't enforce it
3. VIP is manual only — no automatic assignment based on deal value in v1
4. `lifetimeValue` updated when deals close (updated by Deal service)
5. Client remains even if converting lead is soft-deleted
6. Agent ownership is who created the client, not who works their deals

## Error Codes

| Code | Status | When |
|------|--------|------|
| CLIENT_NOT_FOUND | 404 | Client ID doesn't exist |
| DUPLICATE_CLIENT | 409 | Same phone/email in tenant (optional strict mode) |
| FORBIDDEN | 403 | Agent setting VIP, or accessing another agent's client |

## OpenAPI Notes
- Duplicate warning documented as optional field in 201 response
- VIP toggle endpoint shows `vipSetBy` and `vipSetAt` in response
- Lifetime value shown as computed field
