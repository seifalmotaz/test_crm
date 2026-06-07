# Phase 8: Deals & Commission Calculation

## Goal
Implement Deal pipeline with stage FSM, property/lead/client linkage, and synchronous commission calculation on closure.

## Why This Phase Eighth
Deals are where revenue is realized. This is the culmination of the lead pipeline and the trigger for commission records.

---

## File Manifest

- `src/modules/deals/deals.module.ts`
- `src/modules/deals/dto/create-deal.dto.ts`
- `src/modules/deals/dto/update-deal.dto.ts`
- `src/modules/deals/dto/update-stage.dto.ts`
- `src/modules/deals/enums/deal-stage.enum.ts`
- `src/modules/deals/enums/deal-type.enum.ts`
- `src/modules/deals/deals.service.ts`
- `src/modules/deals/deals.controller.ts`
- `src/modules/deals/tests/deals.service.spec.ts`

---

## Task Breakdown

### 8.1 Deals Schema

```typescript
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  propertyId: uuid('property_id'),
  leadId: uuid('lead_id'),
  clientId: uuid('client_id'),
  agentId: uuid('agent_id').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('standard'),
  value: integer('value').notNull(), // cents
  stage: varchar('stage', { length: 20 }).notNull().default('initialContact'),
  probability: integer('probability').default(50),
  offerDate: date('offer_date'),
  targetCloseDate: date('target_close_date'),
  closingDate: timestamp('closing_date', { withTimezone: true }),
  notes: text('notes'),
  createdAt, updatedAt, deletedAt,
});
```

### 8.2 Stage FSM

```typescript
const validTransitions: Record<DealStage, DealStage[]> = {
  initialContact: ['negotiation', 'closedLost'],
  negotiation: ['contractPending', 'closedLost'],
  contractPending: ['closedWon', 'closedLost'],
  closedWon: [], // terminal
  closedLost: [], // terminal
};
```

### 8.3 Commission Calculation on Close

```typescript
async calculateCommission(dealId: string, tenantId: string): Promise<CommissionRecord> {
  return await db.transaction(async (tx) => {
    const deal = await tx.query.deals.findFirst({
      where: and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)),
      with: {
        property: true,
        agent: true,
      },
    });
    
    if (!deal) throw new NotFoundError('DEAL_NOT_FOUND');
    
    // Find commission plan
    let plan = deal.property?.commissionPlanId
      ? await tx.query.commissionPlans.findFirst({
          where: eq(commissionPlans.id, deal.property.commissionPlanId),
        })
      : null;
    
    if (!plan && deal.property?.projectId) {
      const project = await tx.query.projects.findFirst({
        where: eq(projects.id, deal.property.projectId),
      });
      if (project?.commissionPlanId) {
        plan = await tx.query.commissionPlans.findFirst({
          where: eq(commissionPlans.id, project.commissionPlanId),
        });
      }
    }
    
    if (!plan) {
      plan = await tx.query.commissionPlans.findFirst({
        where: and(
          eq(commissionPlans.tenantId, tenantId),
          eq(commissionPlans.isDefault, true),
        ),
      });
    }
    
    if (!plan) throw new AppError('COMMISSION_PLAN_MISSING', 400, 'No commission plan found');
    
    // Calculate
    const valueCents = deal.value;
    let baseCommissionCents: number;
    
    switch (plan.type) {
      case 'percentage':
        baseCommissionCents = Math.round(valueCents * plan.rate);
        break;
      case 'flat':
        baseCommissionCents = plan.flatAmount;
        break;
      case 'tiered': {
        const tier = plan.tierConfig?.find(
          t => valueCents >= t.minValue && valueCents < t.maxValue,
        );
        if (!tier) throw new AppError('COMMISSION_TIER_NOT_FOUND', 400, 'No tier matches deal value');
        baseCommissionCents = Math.round(valueCents * tier.rate);
        break;
      }
    }
    
    const agentSplit = deal.agent.commissionSplit ?? 0.60;
    const agentPayout = Math.round(baseCommissionCents * agentSplit);
    const brokerageShare = baseCommissionCents - agentPayout;
    
    // Create commission record
    const [record] = await tx.insert(commissionRecords).values({
      tenantId,
      dealId: deal.id,
      agentId: deal.agentId,
      propertyId: deal.propertyId,
      planId: plan.id,
      calculatedAmount: baseCommissionCents,
      brokerageAmount: brokerageShare,
      agentPayoutAmount: agentPayout,
      status: 'pending',
      calculatedAt: new Date(),
    }).returning();
    
    // Update property status
    if (deal.propertyId) {
      await tx.update(properties)
        .set({ status: 'sold' })
        .where(eq(properties.id, deal.propertyId));
    }
    
    // Update agent metrics
    await tx.update(users)
      .set({ /* update revenue YTD, deals closed count */ })
      .where(eq(users.id, deal.agentId));
    
    return record;
  });
}
```

### 8.4 Integration Tests

```typescript
describe('Deals', () => {
  it('should create deal linked to property and client', async () => {
    // POST /api/deals
    // Assert 201
    // Assert deal.stage = 'initialContact'
  });
  
  it('should reject deal without linked entity', async () => {
    // POST /api/deals with no propertyId, leadId, or clientId
    // Assert 400 VALIDATION_ERROR
  });
  
  it('should advance deal and update property status', async () => {
    // Create deal with property
    // POST /api/deals/:id/stage { stage: 'negotiation' }
    // Assert property status = 'pending'
  });
  
  it('should require manager approval for closedWon', async () => {
    // Deal in contractPending
    // Agent POSTs to closedWon
    // Assert 403 DEAL_CLOSING_LOCKED
    // Manager POSTs to closedWon
    // Assert 200
  });
  
  it('should calculate commission on close', async () => {
    // Deal value: $450,000 (45000000 cents)
    // Plan rate: 3% (0.03)
    // Agent split: 65% (0.65)
    // Expected: 45000000 * 0.03 * 0.65 = 877500 cents = $8,775
    // Close deal as manager
    // Assert commission record created with exact amount
  });
});
```

---

## Dependencies
- Phase 5 (Properties exist)
- Phase 6 (Leads exist)
- Phase 7 (Clients exist)
- Phase 9 (Commission Plans exist, for calculation)

## Verification

- [ ] `POST /api/deals` without linked entity returns `VALIDATION_ERROR`
- [ ] `POST /api/deals/:id/stage` to `closedWon` by agent returns `DEAL_CLOSING_LOCKED`
- [ ] Manager advancing to `closedWon` triggers commission calculation
- [ ] Commission amount is precise to integer cents
- [ ] Property status changes to `sold` on close
- [ ] Commission preview returns correct breakdown
- [ ] Deal probability is manually settable (no auto-calculation in v1)
- [ ] No deal milestones in v1 — basic notes only

## Risks

| Risk | Mitigation |
|------|-----------|
| Floating point in commission | Use integer cents, Decimal.js for intermediate calc |
| Missing commission plan | Validate plan exists before deal close; default plan required |
