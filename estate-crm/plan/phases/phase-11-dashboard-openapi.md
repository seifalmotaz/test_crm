# Phase 11: Dashboard & OpenAPI Polish

## Goal
Implement role-based dashboard KPI aggregation and finalize OpenAPI documentation with full request/response/error schemas.

## Why This Phase Eleventh
Dashboards are the primary user interface for all roles. OpenAPI documentation is the contract with the frontend — without it, the frontend team cannot generate their client SDK.

---

## File Manifest

- `src/modules/dashboard/dashboard.module.ts`
- `src/modules/dashboard/dashboard.service.ts`
- `src/modules/dashboard/dashboard.controller.ts`
- `src/modules/dashboard/dto/dashboard-response.dto.ts`
- `src/main.ts` (Swagger setup)

---

## Task Breakdown

### 11.1 Dashboard Service

```typescript
@Injectable()
export class DashboardService {
  constructor(
    private db: DrizzleDB,
    private redis: RedisService,
  ) {}
  
  async getDashboard(user: AuthenticatedUser): Promise<DashboardData> {
    const cacheKey = `dashboard:${user.tenantId}:${user.role}:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    let data: DashboardData;
    
    switch (user.role) {
      case 'admin':
        data = await this.getAdminDashboard(user.tenantId);
        break;
      case 'manager':
        data = await this.getManagerDashboard(user.tenantId, user.id);
        break;
      case 'agent':
        data = await this.getAgentDashboard(user.tenantId, user.id);
        break;
    }
    
    await this.redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
    return data;
  }
  
  private async getAdminDashboard(tenantId: string): Promise<AdminDashboard> {
    const [
      propertyCounts,
      leadCounts,
      pipelineValue,
      dealsThisMonth,
      commissionData,
      agentCounts,
      overdueTasks,
    ] = await Promise.all([
      this.getPropertyCounts(tenantId),
      this.getLeadCounts(tenantId),
      this.getPipelineValue(tenantId),
      this.getDealsThisMonth(tenantId),
      this.getCommissionData(tenantId),
      this.getAgentCounts(tenantId),
      this.getOverdueTasks(tenantId),
    ]);
    
    return {
      role: 'admin',
      summary: {
        ...propertyCounts,
        ...leadCounts,
        pipelineValue,
        ...dealsThisMonth,
        ...commissionData,
        ...agentCounts,
        overdueTasks,
      },
    };
  }
  
  // ... manager and agent variants
}
```

### 11.2 Cache Invalidation

```typescript
// Call this after mutations
async invalidateDashboard(tenantId: string, affectedRoles?: string[]): Promise<void> {
  const roles = affectedRoles ?? ['admin', 'manager', 'agent'];
  const keys = roles.map(r => `dashboard:${tenantId}:${r}:*`);
  await this.redis.del(...keys);
}
```

### 11.3 Swagger Setup

```typescript
// In main.ts bootstrap
const config = new DocumentBuilder()
  .setTitle('Estate-CRM API')
  .setDescription('Multi-tenant real estate CRM backend')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('Auth', 'Authentication')
  .addTag('Organizations')
  .addTag('Users')
  .addTag('Projects')
  .addTag('Properties')
  .addTag('Leads')
  .addTag('Clients')
  .addTag('Deals')
  .addTag('Commissions')
  .addTag('Tasks')
  .addTag('Notifications')
  .addTag('Audit')
  .addTag('Dashboard')
  .addTag('Super Admin', 'Cross-tenant administration')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### 11.4 Endpoint Documentation Requirements

Every controller endpoint must have:
- `@ApiOperation()` with clear description
- `@ApiResponse()` for 200/201 with DTO schema
- `@ApiResponse()` for 400 with Problem Details example
- `@ApiResponse()` for 401/403 with Problem Details example
- `@ApiBearerAuth()` if authentication required
- `@ApiQuery()` for query parameters

Example:
```typescript
@ApiOperation({ summary: 'Create a new lead' })
@ApiResponse({ status: 201, type: LeadResponseDto })
@ApiResponse({ status: 400, description: 'Validation error', type: ProblemDetailsDto })
@ApiResponse({ status: 401, description: 'Unauthorized', type: ProblemDetailsDto })
@ApiBearerAuth()
@Post()
async create(@Body() dto: CreateLeadDto): Promise<LeadResponseDto> {}
```

### 11.5 Integration Tests

```typescript
describe('Dashboard', () => {
  it('should return admin dashboard', async () => {
    // Admin auth
    // GET /api/dashboard
    // Assert summary fields present
  });
  
  it('should return agent dashboard with personal data', async () => {
    // Agent auth
    // GET /api/dashboard
    // Assert myLeads, myDeals, commissionPending
  });
  
  it('should cache dashboard data', async () => {
    // First request hits DB
    // Second request served from Redis
    // Assert faster response
  });
});
```

---

## Dependencies
- All previous phases (data exists to aggregate)

## Verification

- [ ] `GET /api/dashboard` returns different data shape for admin vs manager vs agent
- [ ] Dashboard data cached in Redis for 5 minutes
- [ ] Swagger UI at `/api/docs` shows all endpoints with schemas
- [ ] Every endpoint has documented error responses with Problem Details examples
- [ ] OpenAPI spec can be exported as JSON for frontend SDK generation

## Risks

| Risk | Mitigation |
|------|-----------|
| Dashboard query performance | Add composite indexes, cache aggressively |
| Cache stale data | Invalidate on all mutations; 5-min TTL is acceptable |
