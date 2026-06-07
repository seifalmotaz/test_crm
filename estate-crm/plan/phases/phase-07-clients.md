# Phase 7: Clients

## Goal
Implement Client entity with VIP flag, types, and linkage to converted leads. Supports duplicate detection and direct creation by agents.

## Why This Phase Seventh
Clients are the direct relationships that bypass the lead pipeline. Agents need to track existing clients separately from leads-in-progress.

---

## File Manifest

- `src/modules/clients/clients.module.ts`
- `src/modules/clients/dto/create-client.dto.ts`
- `src/modules/clients/dto/update-client.dto.ts`
- `src/modules/clients/dto/set-vip.dto.ts`
- `src/modules/clients/enums/client-type.enum.ts`
- `src/modules/clients/clients.service.ts`
- `src/modules/clients/clients.controller.ts`
- `src/modules/clients/tests/clients.service.spec.ts`

---

## Task Breakdown

### 7.1 Clients Schema

```typescript
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  isVip: boolean('is_vip').default(false),
  vipSetById: uuid('vip_set_by_id'),
  vipSetAt: timestamp('vip_set_at', { withTimezone: true }),
  lifetimeValue: integer('lifetime_value').default(0), // cents
  agentId: uuid('agent_id'),
  convertedFromLeadId: uuid('converted_from_lead_id'),
  notes: text('notes'),
  createdAt, updatedAt, deletedAt,
});
```

### 7.2 Duplicate Detection

```typescript
async checkDuplicate(
  tenantId: string,
  phone: string,
  email?: string,
): Promise<{ type: 'lead' | 'client'; id: string } | null> {
  const leadMatch = await db.query.leads.findFirst({
    where: and(
      eq(leads.tenantId, tenantId),
      eq(leads.phone, phone),
    ),
  });
  
  if (leadMatch) return { type: 'lead', id: leadMatch.id };
  
  if (email) {
    const clientMatch = await db.query.clients.findFirst({
      where: and(
        eq(clients.tenantId, tenantId),
        eq(clients.email, email),
      ),
    });
    if (clientMatch) return { type: 'client', id: clientMatch.id };
  }
  
  return null;
}
```

### 7.3 VIP Toggle

```typescript
async setVip(
  clientId: string,
  tenantId: string,
  isVip: boolean,
  actorId: string,
): Promise<Client> {
  const updates: Partial<Client> = { isVip };
  
  if (isVip) {
    updates.vipSetById = actorId;
    updates.vipSetAt = new Date();
  } else {
    updates.vipSetById = null;
    updates.vipSetAt = null;
  }
  
  const [client] = await db.update(clients)
    .set(updates)
    .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)))
    .returning();
  
  return client;
}
```

### 7.4 Integration Tests

```typescript
describe('Clients', () => {
  it('should create client with duplicate warning', async () => {
    // Create lead with phone +123
    // POST /api/clients with same phone
    // Assert 201 with warning field in response
  });
  
  it('should set VIP and track who did it', async () => {
    // Create client
    // POST /api/clients/:id/vip { isVip: true } as manager
    // Assert isVip = true
    // Assert vipSetById = manager id
  });
  
  it('should reject agent setting VIP', async () => {
    // Agent auth
    // POST /api/clients/:id/vip
    // Assert 403 FORBIDDEN
  });
  
  it('should show linked lead history', async () => {
    // Convert lead to client
    // GET /api/clients/:id/leads
    // Assert lead history present
  });
});
```

---

## Dependencies
- Phase 4 (Users exist)

## Verification

- [ ] Agent can create client directly (bypass lead pipeline)
- [ ] Duplicate detection returns warning when phone/email matches existing lead
- [ ] Manager can set VIP flag and it records `vipSetById` and `vipSetAt`
- [ ] Agent cannot set VIP flag
- [ ] Client with `convertedFromLeadId` shows linked lead history

## Risks

| Risk | Mitigation |
|------|-----------|
| Duplicate detection false positives | Warning only, doesn't block creation |
