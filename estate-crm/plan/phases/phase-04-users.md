# Phase 4: Users & Roles

## Goal
Implement user management within a tenant, including role assignment, agent deactivation, and the departing agent flow. Also includes super admin user management endpoints.

## Why This Phase Fourth
Users are the actors in the system. Projects, properties, leads, deals — all are created and owned by users. The departing agent flow is a critical real estate business requirement.

---

## File Manifest

- `src/modules/users/users.module.ts`
- `src/modules/users/dto/create-user.dto.ts`
- `src/modules/users/dto/update-user.dto.ts`
- `src/modules/users/dto/update-role.dto.ts`
- `src/modules/users/users.service.ts`
- `src/modules/users/users.controller.ts` — Tenant user management
- `src/modules/users/users-admin.controller.ts` — Super admin endpoints
- `src/modules/users/tests/users.service.spec.ts`

---

## Task Breakdown

### 4.1 Users Schema

Already defined in schema, key fields for this phase:
```typescript
{
  id: uuid().primaryKey(),
  tenantId: uuid().notNull(),
  email: varchar(255).notNull(),
  passwordHash: varchar(255).notNull(),
  name: varchar(255).notNull(),
  role: varchar(20).notNull(), // admin, manager, agent
  status: varchar(20).notNull().default('active'),
  departedAt: timestamp(),
  commissionSplit: decimal(), // e.g., 0.60 for 60%
  createdAt, updatedAt, deletedAt
}
```

Unique constraint on `(tenantId, email)`.

### 4.2 Create User DTO

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;
  
  @IsString()
  @MinLength(2)
  name: string;
  
  @IsEnum(['manager', 'agent'])
  role: string;
  
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string; // Generated if not provided
  
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionSplit?: number; // Required for agent
}
```

### 4.3 Service Methods

`UsersService`:
- `create(dto: CreateUserDto, tenantId: string)` — Create user with hashed password
- `findAll(tenantId: string, filters: UserFilters)` — List with role filtering
- `findById(id: string, tenantId: string)` — Get user
- `update(id: string, dto: UpdateUserDto, tenantId: string)` — Update
- `changeRole(id: string, role: string, tenantId: string)` — Change role with validation
- `deactivate(id: string, tenantId: string)` — Departure flow
- `reactivate(id: string, tenantId: string)` — Reactivate departed user

### 4.4 Role Validation Rules

1. Admin can create managers and agents
2. Manager can create agents only (not other managers or admins)
3. Agent cannot create any user
4. Cannot downgrade own role if last admin in organization
5. Role change recorded in audit log

### 4.5 Departure Flow (Deactivation)

```typescript
async deactivate(userId: string, tenantId: string): Promise<DeactivationResult> {
  return await db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
    });
    
    if (!user) throw new NotFoundError('USER_NOT_FOUND');
    if (user.status === 'inactive') throw new AppError('ALREADY_INACTIVE', 400, 'User already inactive');
    
    // Check if last admin
    if (user.role === 'admin') {
      const adminCount = await tx.select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'admin'), eq(users.status, 'active')));
      if (adminCount[0].count <= 1) {
        throw new AppError('LAST_ADMIN', 400, 'Cannot deactivate the last admin');
      }
    }
    
    // Unassign active leads
    const unassignedLeads = await tx.update(leads)
      .set({ 
        agentId: null,
        previousAgentIds: sql`array_append(${leads.previousAgentIds}, ${userId})`,
      })
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.agentId, userId),
        ne(leads.status, 'lost'),
        ne(leads.status, 'reservation'),
      ))
      .returning();
    
    // Set user inactive
    await tx.update(users)
      .set({ status: 'inactive', departedAt: new Date() })
      .where(eq(users.id, userId));
    
    // Create audit log
    await tx.insert(auditLogs).values({
      tenantId,
      actorId: currentUserId, // from auth context
      action: 'user_deactivate',
      targetType: 'user',
      targetId: userId,
      metadata: { unassignedLeads: unassignedLeads.length },
    });
    
    return {
      userId,
      unassignedLeads: unassignedLeads.length,
      departedAt: new Date(),
    };
  });
}
```

### 4.6 Tenant Endpoints

- `GET /api/users` — List users (scoped by role)
- `POST /api/users` — Create user
- `GET /api/users/:id` — Get user
- `PATCH /api/users/:id` — Update user details
- `PATCH /api/users/:id/role` — Change role
- `POST /api/users/:id/deactivate` — Deactivate (departure)
- `POST /api/users/:id/activate` — Reactivate

### 4.7 Super Admin Endpoints

- `GET /api/admin/users` — Cross-tenant user list
- `POST /api/admin/users/:id/reset-password` — Reset password
- `POST /api/admin/users/:id/impersonate` — Generate tenant-scoped JWT

**Impersonation flow:**
1. Super admin POSTs to impersonate endpoint
2. System creates temporary JWT with the target user's claims
3. Returns JWT in response (not cookie, since super admin already has their own session)
4. Super admin uses this JWT to make requests as the tenant user

### 4.8 Integration Tests

```typescript
describe('Users', () => {
  it('should create agent as manager', async () => {
    // Manager auth
    // POST /api/users with role agent
    // Assert 201
  });
  
  it('should reject agent creating user', async () => {
    // Agent auth
    // POST /api/users
    // Assert 403 FORBIDDEN
  });
  
  it('should deactivate agent and unassign leads', async () => {
    // Create agent with 3 leads
    // POST /api/users/:id/deactivate
    // Assert leads unassigned
    // Assert user status inactive
  });
  
  it('should reject deactivating last admin', async () => {
    // Org with 1 admin
    // POST /api/users/:id/deactivate
    // Assert 400 LAST_ADMIN
  });
  
  it('should preserve deals of departed agent', async () => {
    // Create agent with deals
    // Deactivate agent
    // GET /api/deals
    // Assert deals still show departed agent
  });
});
```

---

## Dependencies
- Phase 3 (Organizations exist to contain users)

## Verification

- [ ] Admin can create manager and agent users
- [ ] Manager can create agents but not other managers
- [ ] Agent cannot create users (403)
- [ ] Deactivating agent unassigns leads, preserves deals, freezes KPIs
- [ ] Cannot deactivate last admin
- [ ] Reactivating departed agent clears `departedAt` but doesn't restore old leads
- [ ] Super admin can impersonate tenant admin
- [ ] Role changes recorded in audit log

## Risks

| Risk | Mitigation |
|------|-----------|
| Transaction timeout during mass lead reassignment | Limit to reasonable batch size, document large-scale departure as manual process |
| Self-deactivation edge case | Guard against user deactivating themselves |
