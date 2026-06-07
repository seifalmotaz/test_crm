# Dashboard Module Specification

## Purpose
Provides role-based KPI aggregation for the three user roles. Data is computed synchronously from the database with Redis caching.

## API Endpoints

### GET /api/dashboard

Returns different data based on authenticated user's role.

**Headers:** Cookie with `access_token`

**Response shapes by role:**

#### Admin Response 200
```json
{
  "role": "admin",
  "summary": {
    "totalProperties": 150,
    "activeProperties": 89,
    "pendingProperties": 34,
    "soldProperties": 27,
    "totalLeads": 245,
    "freshLeads": 45,
    "qualifiedLeads": 78,
    "followUpLeads": 89,
    "reservationLeads": 33,
    "pipelineValue": 1250000000,
    "dealsClosedThisMonth": 12,
    "dealsValueThisMonth": 540000000,
    "commissionPending": 8500000,
    "commissionSettledThisMonth": 12000000,
    "activeAgents": 15,
    "inactiveAgents": 3,
    "overdueTasks": 23
  },
  "performance": {
    "agentLeaderboard": [
      { "agentId": "uuid", "name": "Alice", "dealsClosed": 8, "revenue": 320000000, "conversionRate": 0.35 }
    ],
    "underperformers": [
      { "agentId": "uuid", "name": "Bob", "dealsClosed": 1, "revenue": 45000000, "lastActivityDays": 14 }
    ]
  }
}
```

#### Manager Response 200
```json
{
  "role": "manager",
  "summary": {
    "teamLeads": 89,
    "teamDeals": 45,
    "teamPipelineValue": 650000000,
    "unassignedLeads": 12,
    "overdueTeamTasks": 8
  },
  "agents": [
    {
      "agentId": "uuid",
      "name": "Alice",
      "leadsCount": 15,
      "dealsClosed": 8,
      "pipelineValue": 200000000,
      "conversionRate": 0.35,
      "responseTimeHours": 2.5
    }
  ]
}
```

#### Agent Response 200
```json
{
  "role": "agent",
  "summary": {
    "myLeads": 15,
    "freshLeads": 3,
    "qualifiedLeads": 5,
    "followUpLeads": 4,
    "reservationLeads": 3,
    "myDeals": 8,
    "initialContactDeals": 2,
    "negotiationDeals": 3,
    "contractPendingDeals": 2,
    "closedWonDeals": 1,
    "pipelineValue": 200000000,
    "commissionPending": 1500000,
    "commissionSettled": 4500000
  },
  "actions": {
    "followUpsDueToday": 4,
    "dealsClosingSoon": 2,
    "overdueTasks": 1
  },
  "suggestedProperties": [
    { "propertyId": "uuid", "title": "...", "price": 45000000, "matchReason": "Budget and location fit" }
  ]
}
```

## Business Rules

1. Dashboard data computed from live database queries (no materialized views in v1)
2. Results cached in Redis for 5 minutes per user: `dashboard:{tenantId}:{role}:{userId}`
3. Cache invalidated on relevant mutations (e.g., deal stage change clears affected user dashboards)
4. Agent dashboard shows only their own data
5. Manager dashboard shows all agents' data (team filtering deferred to v2)
6. Admin dashboard shows all Organization data
7. Departed agents excluded from active leaderboards, included in historical if `includeInactive=true`
8. Monetary values returned as integer cents (frontend formats)

## Error Codes

| Code | Status | When |
|------|--------|------|
| UNAUTHORIZED | 401 | No valid token |

## OpenAPI Notes
- Single endpoint documented with three response variants (oneOf discriminator by role)
- Cache behavior noted in description
- Suggested properties endpoint documented separately if needed
