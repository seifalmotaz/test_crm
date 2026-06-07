# Phase 12: Integration Tests & Final Verification

## Goal
Comprehensive integration test suite covering critical paths, cross-cutting concerns, and final system verification.

## Why This Phase Last
Testing validates everything built in previous phases. It's the final gate before the backend is ready for frontend integration.

---

## File Manifest

- `vitest.config.ts` — Test runner configuration
- `test/setup.ts` — Test database setup and teardown
- `test/auth-flow.spec.ts` — Authentication critical path
- `test/tenancy-isolation.spec.ts` — Cross-tenant data leak prevention
- `test/lead-deal-pipeline.spec.ts` — Full sales pipeline
- `test/commission-calculation.spec.ts` — Financial precision
- `test/departing-agent.spec.ts` — Historical data preservation
- `test/role-permissions.spec.ts` — RBAC enforcement
- `test/error-contract.spec.ts` — Problem Details format
- `test/dashboard-caching.spec.ts` — Cache behavior

---

## Task Breakdown

### 12.1 Test Infrastructure

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

`test/setup.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

beforeAll(async () => {
  // Run migrations on test database
  // DATABASE_URL points to test DB (port 5433)
});

afterEach(async () => {
  // Truncate all tables
  await db.execute(sql`
    TRUNCATE TABLE 
      organizations, users, projects, properties,
      leads, lead_interactions, clients, deals,
      commission_plans, commission_records, tasks,
      notifications, audit_logs
    CASCADE
  `);
});

afterAll(async () => {
  // Close database connection
});
```

### 12.2 Auth Flow Test

```typescript
describe('Auth Flow', () => {
  it('complete auth lifecycle', async () => {
    // 1. Create test organization and admin
    // 2. Login → get cookie
    // 3. Access /api/auth/me → verify user
    // 4. Wait for token expiry
    // 5. Refresh token → get new cookie
    // 6. Logout → cookie cleared
    // 7. Access /api/auth/me → 401
  });
});
```

### 12.3 Tenancy Isolation Test

```typescript
describe('Tenancy Isolation', () => {
  it('should prevent data leak between tenants', async () => {
    // Create tenant A and tenant B
    // Create lead in tenant A
    // Login as tenant B admin
    // Try GET /api/leads with tenant A lead ID
    // Assert 404 LEAD_NOT_FOUND (not 403 — shouldn't reveal existence)
  });
  
  it('should scope all queries to tenant', async () => {
    // Create 10 properties in tenant A, 5 in tenant B
    // Login as tenant A agent
    // GET /api/properties
    // Assert exactly 10 returned
  });
});
```

### 12.4 Lead-to-Deal Pipeline Test

```typescript
describe('Lead-Deal Pipeline', () => {
  it('should complete full sales cycle', async () => {
    // 1. Create property
    // 2. Create lead (auto-assigned to agent)
    // 3. Agent advances lead: fresh → qualified → followUp → reservation
    // 4. Agent converts lead to client
    // 5. Agent creates deal linked to property and client
    // 6. Manager advances deal: initialContact → negotiation → contractPending → closedWon
    // 7. Verify property status = sold
    // 8. Verify commission record created
    // 9. Verify agent KPIs updated
  });
});
```

### 12.5 Commission Precision Test

```typescript
describe('Commission Calculation', () => {
  it('should calculate exact cents without floating point error', async () => {
    // Deal value: $999,999.99 (99,999,999 cents)
    // Plan rate: 2.5% (0.025)
    // Agent split: 65% (0.65)
    // Expected: floor(99999999 * 0.025 * 0.65) = 1,624,999 cents
    // Assert exact amount
  });
});
```

### 12.6 Departing Agent Test

```typescript
describe('Departing Agent', () => {
  it('should preserve historical data on departure', async () => {
    // 1. Create agent with 3 leads and 2 closed deals
    // 2. Manager deactivates agent
    // 3. Verify leads unassigned (agentId = null)
    // 4. Verify deals still show original agent
    // 5. Verify agent absent from active leaderboard
    // 6. Verify agent present in historical leaderboard
  });
});
```

### 12.7 Role Permissions Test

```typescript
describe('Role Permissions', () => {
  it('should enforce role-based access', async () => {
    // Agent tries POST /api/users → 403
    // Manager tries POST /api/users (role admin) → 403
    // Manager tries POST /api/users (role agent) → 201
    // Agent tries PATCH /api/deals/:id/stage to closedWon → 403
  });
});
```

### 12.8 Final Verification Checklist

- [ ] `bun test` passes with 100% critical path tests green
- [ ] `bun run build` compiles without TypeScript errors
- [ ] `bun run start:prod` starts successfully
- [ ] OpenAPI spec at `/api/docs-json` exports valid JSON
- [ ] No `any` types in domain code (check with `tsc --noEmit`)
- [ ] All database queries include `tenantId` filter
- [ ] All error responses follow Problem Details format
- [ ] Passwords never returned in API responses
- [ ] Soft-deleted records excluded from list queries by default

---

## Dependencies
- All previous phases

## Verification

- [ ] `bun test` passes
- [ ] `bun run build` succeeds
- [ ] `bun run start:prod` runs
- [ ] OpenAPI JSON export valid

## Risks

| Risk | Mitigation |
|------|-----------|
| Test database drift | Re-run migrations before test suite |
| Slow tests | Parallel test execution with isolated transactions |
| Flaky tests | Avoid timing-dependent assertions |
