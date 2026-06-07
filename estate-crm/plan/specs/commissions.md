# Commissions Module Specification

## Purpose
Manages commission plan configurations and commission record lifecycle. Provides financial traceability for agent payouts and brokerage revenue.

**Important v1 Decision:** Commission records are **auto-calculated on deal close** and serve as immutable financial logs. No manual settlement workflow in v1 — the record itself is the final output for accounting. In v2, settlement/void workflows can be added.

## Data Model

### Database Tables

**commissionPlans** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `name`: String
- `type`: Enum [percentage, flat, tiered]
- `rate`: Decimal (nullable for flat/tiered)
- `flatAmount`: Decimal cents (nullable)
- `tierConfig`: JSONB (nullable)
  ```json
  [
    { "minValue": 0, "maxValue": 100000000, "rate": 0.03 },
    { "minValue": 100000000, "maxValue": 500000000, "rate": 0.025 }
  ]
  ```
- `splitConfig`: JSONB (default `{ "listingAgentShare": 50, "buyerAgentShare": 50 }`)
- `isDefault`: Boolean, default false
- `createdAt`, `updatedAt`, `deletedAt`

**commissionRecords** (immutable financial records, no soft delete):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `dealId`: UUIDv7 FK
- `agentId`: UUIDv7 FK
- `propertyId`: UUIDv7 FK, nullable
- `planId`: UUIDv7 FK
- `calculatedAmount`: Int (cents)
- `brokerageAmount`: Int (cents)
- `agentPayoutAmount`: Int (cents)
- `status`: Enum [calculated] — **v1: always "calculated"**
- `calculatedAt`: Timestamp
- `createdAt`

## API Endpoints

### Commission Plans

#### GET /api/commission-plans
**Success 200:** List of plans. Admin only.

#### POST /api/commission-plans
**Request Body:**
```json
{
  "name": "Standard 3%",
  "type": "percentage",
  "rate": 0.03,
  "splitConfig": {
    "listingAgentShare": 50,
    "buyerAgentShare": 50
  },
  "isDefault": true
}
```

**Validation:**
- Exactly one default plan per tenant
- Setting new default unsets previous default

**Success 201:** Created plan.

**Errors:**
- `400 VALIDATION_ERROR` — Missing rate for percentage type
- `400 INVALID_TIER_CONFIG` — Overlapping or invalid tier ranges

#### PATCH /api/commission-plans/:id
**Request Body:** Partial fields.

**Errors:**
- `400 PLAN_IN_USE` — Cannot modify type/rate if used by closed deals

#### DELETE /api/commission-plans/:id
**Validation:** Only if no properties or deals reference this plan.

**Errors:**
- `409 PLAN_IN_USE` — Plan referenced by properties or deals

### Commission Records

#### GET /api/commission-records
**Query:** `?agentId=uuid&dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=20`

**Success 200:** Paginated commission records.
- Agent: sees only own records
- Manager: sees team records
- Admin: sees all

#### GET /api/commission-records/:id
**Success 200:** Full commission details with deal and calculation breakdown.

#### GET /api/commission-records/summary
**Success 200:** Aggregated commission data:
```json
{
  "totalCalculated": 15000000,
  "totalAgentPayout": 9750000,
  "totalBrokerage": 5250000,
  "byAgent": [
    { "agentId": "uuid", "name": "Alice", "totalPayout": 4500000 }
  ]
}
```

**Note:** No settlement/void endpoints in v1. Commission records are immutable logs created automatically on deal closure.

## Commission Calculation Logic

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

All monetary values stored as integer cents. Decimal.js used for calculation, then rounded to nearest cent using `Math.round()`.

## Business Rules

1. One default commission plan per tenant
2. Property can override project and tenant defaults
3. Commission records are **immutable financial logs** — no edit, no settlement, no void in v1
4. Record created automatically when deal hits `closedWon`
5. All calculations use integer cents to prevent floating point errors
6. **No hold period in v1** — record is final when created
7. **No payroll batching in v1** — summary endpoint for accounting review
8. **No adjustment tracking in v1** — if plan changes, only future deals use new plan

## Error Codes

| Code | Status | When |
|------|--------|------|
| COMMISSION_PLAN_NOT_FOUND | 404 | Plan ID doesn't exist |
| COMMISSION_PLAN_MISSING | 400 | No default plan and no property override |
| PLAN_IN_USE | 409 | Plan referenced by properties/deals |
| COMMISSION_NOT_FOUND | 404 | Commission record ID doesn't exist |
| INVALID_TIER_CONFIG | 400 | Overlapping or incomplete tier ranges |

## OpenAPI Notes
- Calculation breakdown shown in all commission record responses
- Tiered plan examples documented with request/response
- Summary endpoint documented for accounting overview
- **v1 Limitation noted:** No settlement workflow; records are immutable logs
