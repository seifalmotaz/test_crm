# Phase 6: Leads & Client Conversion

## Goal
Implement the Lead pipeline with stage FSM, interactions, assignments, and manual Client conversion.

## Why This Phase Sixth
Leads are the lifeblood of a CRM. This is the primary workflow that drives deals. Without leads, there are no deals, no commissions, and no revenue.

---

## File Manifest

- `src/modules/leads/leads.module.ts`
- `src/modules/leads/dto/create-lead.dto.ts`
- `src/modules/leads/dto/update-lead.dto.ts`
- `src/modules/leads/dto/update-stage.dto.ts`
- `src/modules/leads/dto/add-interaction.dto.ts`
- `src/modules/leads/dto/add-tag.dto.ts`
- `src/modules/leads/dto/set-dnc.dto.ts`
- `src/modules/leads/enums/lead-stage.enum.ts`
- `src/modules/leads/enums/lead-source.enum.ts`
- `src/modules/leads/enums/interaction-type.enum.ts`
- `src/modules/leads/leads.service.ts`
- `src/modules/leads/leads.controller.ts`
- `src/modules/leads/tests/leads.service.spec.ts`

---

## Task Breakdown

### 6.1 Leads Schema

```typescript
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  source: varchar('source', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  timeline: integer('timeline'),
  preferredLocation: varchar('preferred_location', { length: 255 }),
  preferredType: varchar('preferred_type', { length: 20 }),
  status: varchar('status', { length: 20 }).notNull().default('fresh'),
  agentId: uuid('agent_id'),
  previousAgentIds: text('previous_agent_ids').array().default([]),
  notes: text('notes'),
  nextAction: varchar('next_action', { length: 255 }),
  nextActionDate: timestamp('next_action_date', { withTimezone: true }),
  isConverted: boolean('is_converted').default(false),
  convertedToClientId: uuid('converted_to_client_id'),
  score: integer('score').default(0),
  createdAt, updatedAt, deletedAt,
});
```

**leadInteractions** (append-only):
```typescript
export const leadInteractions = pgTable('lead_interactions', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  leadId: uuid('lead_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  content: text('content').notNull(),
  agentId: uuid('agent_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 6.2 Stage FSM

```typescript
const validTransitions: Record<LeadStage, LeadStage[]> = {
  fresh: ['qualified', 'lost'],
  qualified: ['fresh', 'followUp', 'lost'],
  followUp: ['qualified', 'reservation', 'lost'],
  reservation: ['followUp', 'lost'],
  lost: [], // terminal
};
```

### 6.3 Auto-Assignment Logic

```typescript
async autoAssignAgent(tenantId: string): Promise<string | null> {
  const result = await db.select({
    agentId: users.id,
    leadCount: count(leads.id),
  })
  .from(users)
  .leftJoin(leads, and(
    eq(leads.agentId, users.id),
    eq(leads.tenantId, tenantId),
    ne(leads.status, 'lost'),
    ne(leads.status, 'reservation'),
  ))
  .where(and(
    eq(users.tenantId, tenantId),
    eq(users.role, 'agent'),
    eq(users.status, 'active'),
  ))
  .groupBy(users.id)
  .orderBy(asc(count(leads.id)))
  .limit(1);
  
  return result[0]?.agentId ?? null;
}
```

### 6.4 Convert Lead to Client

```typescript
async convertLeadToClient(
  leadId: string,
  tenantId: string,
  dto: ConvertLeadDto,
  actorId: string,
): Promise<Client> {
  return await db.transaction(async (tx) => {
    const lead = await tx.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)),
    });
    
    if (!lead) throw new NotFoundError('LEAD_NOT_FOUND');
    if (lead.isConverted) throw new AppError('LEAD_ALREADY_CONVERTED', 400, 'Lead already converted');
    
    // Create client
    const [client] = await tx.insert(clients).values({
      tenantId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      type: dto.type,
      notes: dto.notes,
      agentId: lead.agentId,
      convertedFromLeadId: leadId,
    }).returning();
    
    // Update lead
    await tx.update(leads)
      .set({ isConverted: true, convertedToClientId: client.id })
      .where(eq(leads.id, leadId));
    
    // Audit log
    await tx.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'lead_convert',
      targetType: 'lead',
      targetId: leadId,
      metadata: { clientId: client.id },
    });
    
    return client;
  });
}
```

### 6.5 Integration Tests

```typescript
describe('Leads', () => {
  it('should auto-assign lead to least-loaded agent', async () => {
    // Create 2 agents, one with 5 leads, one with 1
    // POST /api/leads without agentId
    // Assert assigned to agent with 1 lead
  });
  
  it('should advance lead through pipeline', async () => {
    // Create lead in 'fresh'
    // POST /api/leads/:id/stage { status: 'qualified' }
    // Assert status updated
    // POST /api/leads/:id/stage { status: 'followUp' }
    // Assert status updated
  });
  
  it('should reject invalid stage transition', async () => {
    // Lead in 'fresh'
    // POST /api/leads/:id/stage { status: 'reservation' }
    // Assert 400 LEAD_STAGE_INVALID
  });
  
  it('should convert lead to client', async () => {
    // Create lead in 'reservation' stage
    // POST /api/leads/:id/convert { type: 'buyer' }
    // Assert client created
    // Assert lead.isConverted = true
  });
  
  it('should track lead interactions', async () => {
    // Create lead
    // POST /api/leads/:id/interactions { type: 'call', content: '...' }
    // GET /api/leads/:id/interactions
    // Assert interaction in list
  });
});
```

---

## Dependencies
- Phase 4 (Users/agents exist)
- Phase 7 (Clients module, for conversion linkage)

## Verification

- [ ] `POST /api/leads` without `agentId` auto-assigns to least-loaded agent
- [ ] `POST /api/leads/:id/stage` with invalid transition returns `LEAD_STAGE_INVALID`
- [ ] `POST /api/leads/:id/stage` to `lost` from any stage succeeds
- [ ] `POST /api/leads/:id/convert` creates Client and links Lead
- [ ] `POST /api/leads/:id/convert` on already-converted lead returns `LEAD_ALREADY_CONVERTED`
- [ ] Agent can only see own leads (unless manager/admin)
- [ ] Departed agent's leads show `agentId: null` in list
- [ ] Lead score is manually settable by manager/admin (no auto-scoring in v1)

## Risks

| Risk | Mitigation |
|------|-----------|
| Race condition in auto-assignment | Accept rare double-assignment; manual reassignment fixes it |
| Lead interaction bloat | No hard limit in v1; pagination handles large histories |
