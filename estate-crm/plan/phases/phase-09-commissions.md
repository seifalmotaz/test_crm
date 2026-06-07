# Phase 9: Commission Plans & Records

## Goal
Implement tenant-level commission plan configuration and commission record lifecycle. Commission records are **auto-calculated on deal close** and serve as immutable financial logs in v1.

## Why This Phase Ninth
Commission is the financial core of the CRM. Every deal closure depends on a commission plan. This module provides the rules that Phase 8's deal service uses.

---

## File Manifest

- `src/modules/commissions/commissions.module.ts`
- `src/modules/commissions/dto/create-commission-plan.dto.ts`
- `src/modules/commissions/dto/update-commission-plan.dto.ts`
- `src/modules/commissions/enums/commission-plan-type.enum.ts`
- `src/modules/commissions/enums/commission-status.enum.ts`
- `src/modules/commissions/commissions.service.ts`
- `src/modules/commissions/commissions.controller.ts`
- `src/modules/commissions/tests/commissions.service.spec.ts`

---

## Task Breakdown

### 9.1 Commission Plans Schema

```typescript
export const commissionPlans = pgTable('commission_plans', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 4 }),
  flatAmount: integer('flat_amount'),
  tierConfig: jsonb('tier_config'),
  splitConfig: jsonb('split_config').default({ listingAgentShare: 50, buyerAgentShare: 50 }),
  isDefault: boolean('is_default').default(false),
  createdAt, updatedAt, deletedAt,
});
```

### 9.2 Commission Records Schema

```typescript
export const commissionRecords = pgTable('commission_records', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  dealId: uuid('deal_id').notNull(),
  agentId: uuid('agent_id').notNull(),
  propertyId: uuid('property_id'),
  planId: uuid('plan_id').notNull(),
  calculatedAmount: integer('calculated_amount').notNull(),
  brokerageAmount: integer('brokerage_amount').notNull(),
  agentPayoutAmount: integer('agent_payout_amount').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('calculated'), // v1: always "calculated"
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 9.3 Default Plan Management

```typescript
async setDefaultPlan(tenantId: string, planId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Unset previous default
    await tx.update(commissionPlans)
      .set({ isDefault: false })
      .where(and(
        eq(commissionPlans.tenantId, tenantId),
        eq(commissionPlans.isDefault, true),
      ));
    
    // Set new default
    await tx.update(commissionPlans)
      .set({ isDefault: true })
      .where(eq(commissionPlans.id, planId));
  });
}
```

### 9.4 Commission Calculation Logic

```
plan = property.commissionPlanId 
       ?? property.project.commissionPlanId 
       ?? tenant.defaultCommissionPlan

baseCommission = deal.value × plan.rate
agentShare = baseCommission × agent.commissionSplit
brokerageShare = baseCommission × (1 - agent.commissionSplit)

commissionRecord = {
  calculatedAmount: baseCommission (in cents),
  agentPayoutAmount: agentShare (in cents),
  brokerageAmount: brokerageShare (in cents),
  status: 'calculated' // v1 only
}
```

For tiered plans:
```
tier = find tier where deal.value >= tier.minValue && deal.value < tier.maxValue
rate = tier.rate
baseCommission = deal.value × rate
```

For flat plans:
```
baseCommission = plan.flatAmount
agentShare = baseCommission × agent.commissionSplit
```

### 9.5 API Endpoints

#### Commission Plans
- `GET /api/commission-plans` — List
- `POST /api/commission-plans` — Create
- `PATCH /api/commission-plans/:id` — Update
- `DELETE /api/commission-plans/:id` — Soft delete (only if unused)

#### Commission Records
- `GET /api/commission-records` — List
- `GET /api/commission-records/:id` — Get details
- `GET /api/commission-records/summary` — Aggregated data for accounting

**No settlement/void endpoints in v1.** Commission records are immutable logs created automatically on deal closure.

### 9.6 Integration Tests

```typescript
describe('Commissions', () => {
  it('should create percentage plan', async () => {
    // POST /api/commission-plans
    // Assert 201
  });
  
  it('should set default plan and unset previous', async () => {
    // Create plan A as default
    // Create plan B, set as default
    // Assert plan A isDefault = false
    // Assert plan B isDefault = true
  });
  
  it('should auto-calculate commission on deal close', async () => {
    // Close deal
    // Assert commission record created automatically
    // Assert exact cents calculation
  });
});
```

---

## Dependencies
- Phase 3 (Organization exists)
- Phase 4 (Users/agents exist with commissionSplit)

## Verification

- [ ] Exactly one default plan per tenant
- [ ] Setting new default unsets previous
- [ ] Commission record created automatically when deal closes
- [ ] Record contains correct calculated amounts in integer cents
- [ ] All calculations use integer cents (no floating point errors)
- [ ] No settlement workflow in v1 — records are read-only logs
- [ ] Plan in use cannot have type/rate modified

## Business Rules

1. One default commission plan per tenant
2. Property can override project and tenant defaults
3. Commission records are **immutable financial logs** — no edit in v1
4. Record created automatically when deal hits `closedWon`
5. All calculations use integer cents to prevent floating point errors
6. **No hold period in v1** — record is final when created
7. **No payroll batching in v1** — summary endpoint for accounting review
8. **No adjustment tracking in v1** — if plan changes, only future deals use new plan

## Risks

| Risk | Mitigation |
|------|-----------|
| Plan deletion with active references | Validate no properties/deals reference plan before delete |
| Commission precision | Use integer cents, Decimal.js for intermediate calc |

## Error Codes

| Code | Status | When |
|------|--------|------|
| COMMISSION_PLAN_NOT_FOUND | 404 | Plan ID doesn't exist |
| COMMISSION_PLAN_MISSING | 400 | No default plan and no property override |
| PLAN_IN_USE | 409 | Plan referenced by properties/deals |
| COMMISSION_NOT_FOUND | 404 | Commission record ID doesn't exist |
| INVALID_TIER_CONFIG | 400 | Overlapping or incomplete tier ranges |
