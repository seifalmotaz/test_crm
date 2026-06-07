# Users Module Specification

## Purpose
Manages users within a tenant, including role assignment, agent deactivation, and the departing agent flow. Also includes super admin user management endpoints.

## Data Model

Extends the `users` table defined in Auth spec. Key fields:
- `commissionSplit`: Decimal, nullable for non-agents
- `departedAt`: Timestamp, nullable
- `status`: active | inactive | suspended

## API Endpoints

### Tenant-Scoped

#### GET /api/users
**Query:** `?status=active&role=agent&search=john&page=1&limit=20`

**Success 200:** Paginated user list.
- Admin: sees all users in Organization
- Manager: sees team agents (all agents for now, team filtering deferred)
- Agent: sees only self

#### POST /api/users
**Request Body:**
```json
{
  "email": "string",
  "name": "string",
  "role": "manager|agent",
  "password": "string (optional, generates temp if missing)",
  "commissionSplit": 0.65 // Required for agents, ignored for managers
}
```

**Success 201:** Created user.

**Errors:**
- `400 VALIDATION_ERROR` — Invalid role, missing commissionSplit for agent
- `409 USER_ALREADY_EXISTS` — Email already in tenant
- `403 FORBIDDEN` — Agent trying to create user

#### GET /api/users/:id
**Success 200:** User details.
- Agent can only see self
- Manager can see team agents
- Admin sees all

#### PATCH /api/users/:id
**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "commissionSplit": 0.70,
  "status": "active"
}
```

**Errors:**
- `404 USER_NOT_FOUND`
- `403 FORBIDDEN` — Editing user outside scope

#### PATCH /api/users/:id/role
**Request Body:**
```json
{
  "role": "manager|agent"
}
```

**Business Rules:**
- Cannot downgrade own role if last admin
- Manager cannot change admin roles
- Role change recorded in audit log

#### POST /api/users/:id/deactivate
**Trigger:** Agent departure flow.

**Side Effects:**
1. Set `status` to `inactive`
2. Set `departedAt` to now
3. All active leads: set `agentId` to null, append user ID to `previousAgentIds`
4. Deals remain linked (historical accuracy)
5. User can no longer authenticate

**Success 200:** Deactivated user with summary of side effects.

**Errors:**
- `400 CANNOT_DEACTIVATE_SELF` — User deactivating themselves
- `400 LAST_ADMIN` — Cannot deactivate last admin

#### POST /api/users/:id/activate
**Success 200:** Reactivates a departed user. Clears `departedAt`.

### Super Admin

#### GET /api/admin/users
**Query:** `?tenantId=uuid&role=agent&search=john`

**Success 200:** Cross-tenant user list.

#### POST /api/admin/users/:id/reset-password
**Success 200:** Generates temporary password, sends (or returns for now).

#### POST /api/admin/users/:id/impersonate
**Success 200:** Returns temporary JWT scoped to user's tenant.

## Business Rules

1. Email unique per tenant (not globally unique)
2. Admin can create managers and agents. Manager can create agents only.
3. Agent cannot create users.
4. Deactivating an agent is irreversible in terms of lead assignments (unassigned leads don't auto-reassign)
5. Reactivating a departed agent does not restore their old leads — they start fresh
6. Commission split is stored as decimal (e.g., 0.60 = 60% to agent, 40% to brokerage)
7. Departed agents appear in historical reports with `includeInactive=true` flag
8. **No agent tiers in v1** — no elite/core/developing ranking system. Basic performance metrics only.

## Error Codes

| Code | Status | When |
|------|--------|------|
| USER_NOT_FOUND | 404 | User ID doesn't exist |
| USER_ALREADY_EXISTS | 409 | Email in use within tenant |
| FORBIDDEN | 403 | Role/permission insufficient |
| CANNOT_DEACTIVATE_SELF | 400 | Self-deactivation attempt |
| LAST_ADMIN | 400 | Cannot remove last admin |
| INVALID_ROLE | 400 | Invalid role assignment |

## OpenAPI Notes
- Departure flow documented with side effect descriptions
- Role change endpoint shows before/after in examples
