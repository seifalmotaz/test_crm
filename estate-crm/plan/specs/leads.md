# Leads Module Specification

## Purpose
Manages prospective buyers/sellers through a pipeline. Supports interactions, assignments, tags, documents, DNC compliance, and manual Client conversion.

**Important v1 Decision:** All lead scoring, stage advancement, and qualification is **MANUAL** in v1. No auto-scoring, no auto-qualification, no automatic stage progression.

## Data Model

### Database Tables

**leads** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `name`: String
- `email`: String, nullable
- `phone`: String
- `source`: Enum [website, referral, social, walkIn, other]
- `type`: Enum [investor, family, firstTime, other]
- `budgetMin`: Decimal (cents), nullable
- `budgetMax`: Decimal (cents), nullable
- `timeline`: Int (days), nullable
- `preferredLocation`: String, nullable
- `preferredType`: Enum [apartment, villa, commercial, townhouse, land], nullable
- `status`: Enum [fresh, qualified, followUp, reservation, lost]
- `score`: Int, default 0 — **manually set by manager/admin in v1**
- `agentId`: UUIDv7 FK, nullable
- `previousAgentIds`: Text[]
- `notes`: String, nullable
- `nextAction`: String, nullable
- `nextActionDate`: Date, nullable
- `isConverted`: Boolean, default false
- `convertedToClientId`: UUIDv7 FK, nullable
- **isDnc**: Boolean, default false — **Do Not Contact flag**
- **dncReason**: String, nullable
- **dncSetAt**: Timestamp, nullable
- **dncSetById**: UUIDv7 FK, nullable
- `createdAt`, `updatedAt`, `deletedAt`

**activities** (polymorphic, append-only timeline for leads AND deals):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `entityType`: Enum [lead, deal] — **polymorphic discriminator**
- `entityId`: UUIDv7 FK — **leadId or dealId**
- `type`: Enum [call, email, meeting, note, whatsapp, sms, voicemail, directMail, stageChange, assignment, documentUpload, tagAdded, tagRemoved, dncSet, dncRemoved, converted, comment]
- `content`: String — **main text/content of the activity**
- `metadata`: JSONB — **structured data for specific activity types**
  - `stageChange`: `{ from: "fresh", to: "qualified" }`
  - `assignment`: `{ fromAgentId: "uuid", toAgentId: "uuid" }`
  - `documentUpload`: `{ documentId: "uuid", documentName: "contract.pdf", url: "..." }`
  - `tagAdded`: `{ tag: "Hot", color: "#ff0000" }`
  - `dncSet`: `{ reason: "Client requested", effectiveDate: "2024-06-07" }`
- `agentId`: UUIDv7 FK — **who performed the action**
- `createdAt`

**leadTags** (polymorphic tagging):
- `id`: UUIDv7 PK
- `leadId`: UUIDv7 FK
- `tag`: String
- `color`: String (hex, e.g., "#ff0000")

**leadDocuments** (per-lead file uploads):
- `id`: UUIDv7 PK
- `leadId`: UUIDv7 FK
- `name`: String
- `url`: String (S3 URL)
- `type`: String (pdf, image, other)
- `uploadedAt`: Timestamp

## API Endpoints

#### GET /api/leads
**Query:** `?status=fresh&source=website&agentId=uuid&search=john&page=1&limit=20`

**Success 200:** Paginated lead list.
- Agent: sees only own leads
- Manager: sees team leads
- Admin: sees all

#### POST /api/leads
**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+971501234567",
  "source": "website",
  "type": "family",
  "budgetMin": 300000,
  "budgetMax": 500000,
  "timeline": 60,
  "preferredLocation": "Downtown",
  "preferredType": "apartment",
  "notes": "Looking for 2BR",
  "agentId": "uuid",
  "score": 75 // Optional, manual score set by creator
}
```

**Auto-Assignment:**
- If `agentId` provided: assign to that agent
- If null: assign to agent with fewest active leads
- If no agents available: leave unassigned

**Success 201:** Created lead.

#### GET /api/leads/:id
**Success 200:** Lead with **activity timeline** (chronological activities), tags, and documents.

#### PATCH /api/leads/:id
**Request Body:** Partial fields.
- `score`: Can be manually updated by manager/admin
- `status`: Can be updated directly (no auto-qualification in v1)

**Automatic Activity Logging:**
When updating certain fields, the system automatically creates an activity record:
- `status` change → `stageChange` activity
- `agentId` change → `assignment` activity
- `isDnc` set → `dncSet` activity
- `isDnc` removed → `dncRemoved` activity
- `isConverted` set → `converted` activity

#### POST /api/leads/:id/activities
**Request Body:**
```json
{
  "type": "call",
  "content": "Discussed budget and timeline. Client interested in downtown apartments.",
  "metadata": {
    "duration": 15,
    "outcome": "positive"
  }
}
```

**Success 201:** Created activity. Appears in lead timeline.

#### GET /api/leads/:id/activities
**Query:** `?type=call&agentId=uuid&dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=50`

**Success 200:** Chronological activity timeline.

#### DELETE /api/leads/:id/activities/:activityId
**Only the activity creator or manager/admin can delete.**

**Success 204:** Activity deleted.

**Errors:**
- `403 FORBIDDEN` — Non-creator trying to delete

#### POST /api/leads/:id/convert
**Manual conversion to Client.**

**Request Body:**
```json
{
  "type": "buyer",
  "notes": "Ready to proceed with viewings"
}
```

**Side Effects:**
1. Create Client record with lead's contact info
2. Set `convertedFromLeadId` on Client
3. Set `isConverted = true` and `convertedToClientId` on Lead
4. Lead remains visible but marked converted

**Errors:**
- `400 LEAD_ALREADY_CONVERTED` — Lead already converted
- `400 LEAD_NOT_READY` — Optional: require reservation stage

#### GET /api/leads/stale
**Success 200:** Leads with `nextActionDate < today` and status not `lost` or `reservation`.

## Business Rules

1. Leads are append-only for interactions
2. Stage transitions must be adjacent (except `lost` from anywhere)
3. Departed agents' leads become unassigned
4. Converted leads remain in system for historical reference
5. Auto-assignment distributes leads to least-loaded active agent
6. `previousAgentIds` preserves full reassignment history
7. **No auto-scoring in v1** — `score` is a manual field set by manager/admin
8. **No auto-qualification in v1** — Leads do not auto-advance based on conditions
9. **No lead merge in v1** — Duplicate detection creates warnings only

## Error Codes

| Code | Status | When |
|------|--------|------|
| LEAD_NOT_FOUND | 404 | Lead ID doesn't exist |
| LEAD_STAGE_INVALID | 400 | Invalid stage transition |
| LEAD_ALREADY_CONVERTED | 400 | Lead already converted to client |
| LEAD_NOT_READY | 400 | Lead not in reservation stage for conversion |
| AGENT_NOT_FOUND | 404 | Agent ID doesn't exist |
| AGENT_INACTIVE | 400 | Agent is departed/inactive |
| FORBIDDEN | 403 | Agent accessing another agent's lead |

## OpenAPI Notes
- Stage transition endpoint documents valid transitions explicitly
- Conversion endpoint shows before/after state in examples
- Stale leads endpoint documented as synchronous query (not background job)
- Score field documented as manually settable by manager/admin
