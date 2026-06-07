# Deals Module Specification

## Purpose
Manages property transactions from initial contact through closure. Integrates with commission calculation, property status lifecycle, document management, and lightweight milestones.

**Important v1 Decision:** Deal probability is a **MANUAL** field in v1. No auto-calculated probability engine, no risk categories, no situational deductions.

## Data Model

### Database Tables

**deals** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `propertyId`: UUIDv7 FK, nullable
- `leadId`: UUIDv7 FK, nullable
- `clientId`: UUIDv7 FK, nullable
- `agentId`: UUIDv7 FK
- `type`: Enum [standard, luxury, investment]
- `value`: Decimal (cents)
- `stage`: Enum [initialContact, negotiation, contractPending, closedWon, closedLost]
- `probability`: Int, default 50 — **manually set in v1**
- `offerDate`: Date, nullable
- `targetCloseDate`: Date, nullable
- `closingDate`: Date, nullable
- **daysUntilClose**: Int, nullable — **auto-calculated from targetCloseDate**
- **daysElapsed**: Int, default 0 — **auto-calculated from offerDate**
- `notes`: String, nullable
- `createdAt`, `updatedAt`, `deletedAt`

At least one of `propertyId`, `leadId`, `clientId` must be set (business rule, not DB constraint).

**dealTags** (polymorphic tagging):
- `id`: UUIDv7 PK
- `dealId`: UUIDv7 FK
- `tag`: String
- `color`: String (hex)

**dealDocuments** (per-deal file uploads):
- `id`: UUIDv7 PK
- `dealId`: UUIDv7 FK
- `name`: String
- `url`: String (S3 URL)
- `type`: String (pdf, image, contract, other)
- `uploadedAt`: Timestamp

**dealMilestones** (lightweight checklist):
- `id`: UUIDv7 PK
- `dealId`: UUIDv7 FK
- `name`: String
- `dueDate`: Date, nullable
- `status`: Enum [pending, completed]
- `createdAt`

## API Endpoints

#### GET /api/deals
**Query:** `?stage=negotiation&agentId=uuid&minValue=100000&maxValue=1000000&closeDateFrom=2024-01-01&closeDateTo=2024-12-31&page=1&limit=20`

**Success 200:** Paginated deal list.
- Agent: sees only own deals
- Manager: sees team deals
- Admin: sees all

#### POST /api/deals
**Request Body:**
```json
{
  "propertyId": "uuid",
  "clientId": "uuid",
  "agentId": "uuid",
  "type": "standard",
  "value": 45000000,
  "offerDate": "2024-06-01",
  "targetCloseDate": "2024-08-01",
  "notes": "Cash buyer, quick close expected"
}
```

**Validation:**
- At least one of `propertyId`, `leadId`, `clientId` provided
- `propertyId` if provided: property must be `active` or `pending`

**Success 201:** Created deal in `initialContact` stage.

**Errors:**
- `400 VALIDATION_ERROR` — No linked entity
- `404 PROPERTY_NOT_FOUND`
- `404 CLIENT_NOT_FOUND`
- `400 PROPERTY_STATUS_CONFLICT` — Property not available

#### GET /api/deals/:id
**Success 200:** Deal with linked property, lead/client, agent, commission preview, **activity timeline**, tags, documents, and milestones.

#### PATCH /api/deals/:id
**Request Body:** Partial fields (excluding stage).
- `probability`: Can be manually updated by agent/manager

**Automatic Activity Logging:**
When updating certain fields, the system automatically creates an activity record:
- `stage` change → `stageChange` activity
- `value` change → `valueChange` activity
- `probability` change → `probabilityChange` activity
- `agentId` change → `assignment` activity

#### POST /api/deals/:id/stage
**Request Body:**
```json
{ "stage": "negotiation" }
```

**FSM Validation:**
- initialContact → negotiation ✓
- initialContact → contractPending ✗
- negotiation → contractPending ✓
- contractPending → closedWon ✓ (requires MANAGER or ADMIN role)
- contractPending → closedLost ✓
- closedWon → anything ✗ (terminal)
- closedLost → anything ✗ (terminal)

**Side Effects on Advance:**

1. **initialContact → negotiation:**
   - If property linked: set property status to `pending`

2. **negotiation → contractPending:**
   - Record `targetCloseDate` if not set

3. **contractPending → closedWon:**
   - If property linked: set property status to `sold`
   - Record `closingDate`
   - Trigger commission calculation:
     - Find commission plan (property → project → tenant default)
     - Calculate: `value × plan.rate × agent.commissionSplit`
     - Create CommissionRecord with `calculated` status
   - Update agent metrics (deals closed, revenue YTD)
   - Create notification for agent

4. **Any → closedLost:**
   - If property was `pending`: revert to `active`
   - Record closure reason (optional)

**Errors:**
- `400 DEAL_STAGE_INVALID` — Invalid transition
- `403 DEAL_CLOSING_LOCKED` — Agent trying to advance to closedWon

#### PATCH /api/deals/:id/probability
**Request Body:**
```json
{ "probability": 75 }
```

**Note:** Probability is **manually set** in v1. No auto-calculation based on stage or risk factors.

#### GET /api/deals/:id/commission
**Success 200:**
```json
{
  "dealId": "uuid",
  "propertyId": "uuid",
  "planId": "uuid",
  "planName": "Standard 3%",
  "dealValue": 45000000,
  "planRate": 0.03,
  "agentSplit": 0.65,
  "calculatedAmount": 877500,
  "brokerageAmount": 472500,
  "currency": "USD"
}
```

Returns preview if not yet calculated, actual if deal is closedWon.

#### POST /api/deals/:id/documents
**Request Body:**
```json
{
  "filename": "contract.pdf",
  "contentType": "application/pdf"
}
```

**Success 200:** Pre-signed S3 PUT URL and final fileUrl.

#### POST /api/deals/:id/tags
**Request Body:**
```json
{
  "tag": "Urgent",
  "color": "#ff0000"
}
```

**Success 201:** Tag added to deal.

#### DELETE /api/deals/:id/tags/:tagId
**Success 204:** Tag removed from deal.

#### GET /api/deals/:id/milestones
**Success 200:** List of deal milestones with status.

#### POST /api/deals/:id/milestones
**Request Body:**
```json
{
  "name": "Inspection Complete",
  "dueDate": "2024-06-15"
}
```

**Success 201:** Milestone created.

#### PATCH /api/deals/:id/milestones/:milestoneId
**Request Body:**
```json
{ "status": "completed" }
```

**Success 200:** Milestone status updated.

## Business Rules

1. Deal stage strictly forward (except closedLost from any stage)
2. closedWon requires manager/admin approval (closing lock)
3. Commission calculated synchronously on close using integer cents
4. Property status changes as side effect of deal stage changes
5. Deal value immutable after creation (or admin-only edit)
6. Departed agents' deals remain linked historically
7. Duplicate deals on same property allowed (e.g., backup buyers)
8. **Milestones are lightweight checklist** — no auto-creation, no dependencies between milestones
9. **No auto-probability in v1** — probability is a manual field
10. **Documents use S3 pre-signed URLs** — no local storage

## Error Codes

| Code | Status | When |
|------|--------|------|
| DEAL_NOT_FOUND | 404 | Deal ID doesn't exist |
| DEAL_STAGE_INVALID | 400 | Invalid stage transition |
| DEAL_CLOSING_LOCKED | 403 | Agent attempting manager-only advance |
| DEAL_PROPERTY_MISMATCH | 400 | Property not in tenant or unavailable |
| PROPERTY_STATUS_CONFLICT | 400 | Property already sold |
| COMMISSION_PLAN_MISSING | 400 | No commission plan found for deal |

## OpenAPI Notes
- Stage advancement documented with full side effect descriptions
- Commission preview shows calculation breakdown
- Document upload follows S3 pre-signed URL pattern
- Probability documented as manually settable field
- Milestones documented as simple checklist (not workflow engine)
