import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { createTestApp } from '../helpers/test-app';
import { truncateAllWithOrg } from '../helpers/db-cleanup';
import { extractAccessToken } from '../helpers/auth-helper';
import { db } from '@/db/connection';
import { redis } from '@/db/redis';
import { hashPassword } from '@/common/utils/password';
import { superAdmins, commissionPlans, commissionRecords, organizations, users, properties, projects, deals, notifications, auditLogs } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Integration tests for the Commissions module.
 * These tests require a running PostgreSQL and Redis instance (Docker).
 * They will be skipped if the database is not available.
 */
describe('Commissions Module (Phase 9)', () => {
  let app: INestApplication;
  let superAdminCookie: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(module);
    await truncateAllWithOrg(db);

    const hash = await hashPassword('super123!');
    await db.insert(superAdmins).values({
      email: 'super@commissions-test.com',
      passwordHash: hash,
      name: 'Commissions Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@commissions-test.com', password: 'super123!' });

    superAdminCookie = extractAccessToken(loginRes.headers['set-cookie'])!;
    expect(superAdminCookie).toBeTruthy();
  });

  afterAll(async () => {
    await app?.close();
    await redis.quit();
  });

  // ─── Helpers ───────────────────────────────────────────

  async function createOrgAndAdmin() {
    const ts = Date.now();
    const body = {
      name: `Test Org ${ts}`,
      slug: `test-org-${ts}`,
      adminEmail: `admin-${ts}@test.com`,
      adminName: 'Test Admin',
      adminPassword: 'AdminPass123!',
    };
    const res = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set('Cookie', `access_token=${superAdminCookie}`)
      .send(body);

    expect(res.status).toBe(201);
    const org = res.body.organization;

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: body.adminEmail, password: body.adminPassword });

    const adminCookie = extractAccessToken(loginRes.headers['set-cookie'])!;
    expect(adminCookie).toBeTruthy();

    return { org, adminCookie };
  }

  async function createUserAs(creatorCookie: string, dto: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Cookie', `access_token=${creatorCookie}`)
      .send(dto);
    return res;
  }

  async function loginAs(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    return extractAccessToken(res.headers['set-cookie'])!;
  }

  async function createProperty(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        title: `Property ${ts}`,
        address: `${ts} Main St`,
        type: 'apartment',
        price: 25000000,
        ...overrides,
      });
    return res;
  }

  async function createDeal(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();

    let propertyId = overrides.propertyId as string | undefined;
    if (!propertyId) {
      const propRes = await createProperty(adminCookie);
      propertyId = propRes.body.id;
    }

    let agentId = overrides.agentId as string | undefined;
    if (!agentId) {
      const agentRes = await createUserAs(adminCookie, {
        email: `agent-deal-${ts}@test.com`,
        name: 'Deal Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });
      agentId = agentRes.body.id;
    }

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        agentId,
        propertyId,
        type: 'standard',
        value: 99999999,
        ...overrides,
      });
    return res;
  }

  async function advanceDealToContractPending(adminCookie: string, dealId: string) {
    await request(app.getHttpServer())
      .post(`/api/deals/${dealId}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${dealId}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
  }

  // ─── Plan Resolution Tests ────────────────────────────

  describe('Plan resolution chain', () => {
    it('Property has plan → uses property plan', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      // Create a property-level commission plan
      const [propPlan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Property Plan 3%',
        type: 'percentage',
        rate: '0.0300',
        isDefault: false,
      }).returning();

      // Create property with this plan
      const propRes = await createProperty(adminCookie, { commissionPlanId: propPlan.id });
      const propertyId = propRes.body.id;

      // Create agent
      const agentRes = await createUserAs(adminCookie, {
        email: `agent-prop-plan-${Date.now()}@test.com`,
        name: 'Prop Plan Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      // Create deal
      const dealRes = await createDeal(adminCookie, {
        propertyId,
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      // Close the deal
      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(200);

      // Verify commission record uses property plan
      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      expect(record).toBeDefined();
      expect(record.planId).toBe(propPlan.id);
    });

    it('Property has no plan, project has plan → uses project plan', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      // Create a project-level commission plan
      const [projPlan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Project Plan 2.5%',
        type: 'percentage',
        rate: '0.0250',
        isDefault: false,
      }).returning();

      // Create project with this plan
      const [project] = await db.insert(projects).values({
        tenantId: org.id,
        name: `Test Project ${Date.now()}`,
        location: 'Test Location',
        commissionPlanId: projPlan.id,
      }).returning();

      // Create property under this project (no commissionPlanId)
      const propRes = await createProperty(adminCookie, { projectId: project.id });
      const propertyId = propRes.body.id;

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-proj-plan-${Date.now()}@test.com`,
        name: 'Proj Plan Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        propertyId,
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(200);

      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      expect(record).toBeDefined();
      expect(record.planId).toBe(projPlan.id);
    });

    it('Tenant default → uses default plan', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      // Create a default plan
      const [defaultPlan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      // Create property with NO commissionPlanId and NO project
      const propRes = await createProperty(adminCookie);
      const propertyId = propRes.body.id;

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-default-plan-${Date.now()}@test.com`,
        name: 'Default Plan Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        propertyId,
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(200);

      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      expect(record).toBeDefined();
      expect(record.planId).toBe(defaultPlan.id);
    });

    it('No plans → throws COMMISSION_PLAN_MISSING', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      // Delete any default plans
      await db.delete(commissionPlans).where(eq(commissionPlans.tenantId, org.id));

      const propRes = await createProperty(adminCookie);
      const propertyId = propRes.body.id;

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-no-plan-${Date.now()}@test.com`,
        name: 'No Plan Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        propertyId,
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(400);
      expect(closeRes.body.code).toBe('COMMISSION_PLAN_MISSING');
    });
  });

  // ─── Auto-calculation Tests ────────────────────────────

  describe('Auto-calculation on deal close', () => {
    it('Creates commission record with correct amounts', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      // Create a default plan
      const [defaultPlan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Standard 2.5%',
        type: 'percentage',
        rate: '0.0250',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-calc-${Date.now()}@test.com`,
        name: 'Calc Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        agentId: agentRes.body.id,
        value: 99999999, // $999,999.99
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(200);

      // Verify commission record
      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      expect(record).toBeDefined();
      // base = round(99,999,999 × 0.025) = 2,500,000
      // agent = floor(2,500,000 × 0.65) = 1,625,000
      // brokerage = 2,500,000 - 1,625,000 = 875,000
      expect(record.calculatedAmount).toBe(2_500_000);
      expect(record.agentPayoutAmount).toBe(1_625_000);
      expect(record.brokerageAmount).toBe(875_000);
      expect(record.status).toBe('calculated');
    });

    it('Sets property.status = sold', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const propRes = await createProperty(adminCookie);
      const propertyId = propRes.body.id;

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-sold-${Date.now()}@test.com`,
        name: 'Sold Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        propertyId,
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      const [prop] = await db
        .select({ status: properties.status })
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      expect(prop.status).toBe('sold');
    });

    it('Creates notification', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-notif-${Date.now()}@test.com`,
        name: 'Notif Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      const [notif] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, agentRes.body.id))
        .limit(1);

      expect(notif).toBeDefined();
      expect(notif.type).toBe('commission_calculated');
    });

    it('Creates audit log entry', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-audit-${Date.now()}@test.com`,
        name: 'Audit Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.action, 'commission.calculated'), eq(auditLogs.targetType, 'commission')))
        .limit(1);

      expect(log).toBeDefined();
      expect(log.actorId).toBeTruthy();
    });
  });

  // ─── Duplicate Close Blocked ───────────────────────────

  describe('Duplicate close blocked', () => {
    it('Manually create commission record, then close → 409 COMMISSION_DUPLICATE', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-dup-${Date.now()}@test.com`,
        name: 'Dup Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        agentId: agentRes.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      // Manually create a commission record for this deal
      await db.insert(commissionRecords).values({
        tenantId: org.id,
        dealId,
        agentId: agentRes.body.id,
        planId: plan.id,
        calculatedAmount: 5_000_000,
        brokerageAmount: 1_750_000,
        agentPayoutAmount: 3_250_000,
        status: 'calculated',
        calculatedAt: new Date(),
      });

      // Try to close — should fail with duplicate
      await advanceDealToContractPending(adminCookie, dealId);
      const closeRes = await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      expect(closeRes.status).toBe(409);
      expect(closeRes.body.code).toBe('COMMISSION_DUPLICATE');
    });
  });

  // ─── Permission Boundaries ────────────────────────────

  describe('Permission boundaries', () => {
    it('Agent GET /api/commission-records?agentId=other-agent → empty list', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      // Create two agents
      const agent1Res = await createUserAs(adminCookie, {
        email: `agent-perm1-${Date.now()}@test.com`,
        name: 'Perm Agent 1',
        role: 'agent',
        commissionSplit: '0.6500',
      });
      const agent1Cookie = await loginAs(agent1Res.body.email, 'AdminPass123!');

      const agent2Res = await createUserAs(adminCookie, {
        email: `agent-perm2-${Date.now()}@test.com`,
        name: 'Perm Agent 2',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      // Create a deal for agent2 and close it
      const dealRes = await createDeal(adminCookie, {
        agentId: agent2Res.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      // Agent1 tries to list with agent2's ID — should see empty (agent filter forces own ID)
      const listRes = await request(app.getHttpServer())
        .get('/api/commission-records?agentId=' + agent2Res.body.id)
        .set('Cookie', `access_token=${agent1Cookie}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(0);
    });

    it('Agent GET /api/commission-records/:id (other agent\'s record) → 404', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const agent1Res = await createUserAs(adminCookie, {
        email: `agent-find1-${Date.now()}@test.com`,
        name: 'Find Agent 1',
        role: 'agent',
        commissionSplit: '0.6500',
      });
      const agent1Cookie = await loginAs(agent1Res.body.email, 'AdminPass123!');

      const agent2Res = await createUserAs(adminCookie, {
        email: `agent-find2-${Date.now()}@test.com`,
        name: 'Find Agent 2',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      // Create a deal for agent2 and close it
      const dealRes = await createDeal(adminCookie, {
        agentId: agent2Res.body.id,
        value: 100000000,
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      // Get the commission record
      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      // Agent1 tries to get agent2's record
      const getRes = await request(app.getHttpServer())
        .get(`/api/commission-records/${record.id}`)
        .set('Cookie', `access_token=${agent1Cookie}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe('COMMISSION_NOT_FOUND');
    });

    it('Manager GET /api/commission-records → sees all in tenant', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Default 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const managerRes = await createUserAs(adminCookie, {
        email: `manager-list-${Date.now()}@test.com`,
        name: 'List Manager',
        role: 'manager',
      });
      const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

      // Create two deals and close them
      for (let i = 0; i < 2; i++) {
        const agentRes = await createUserAs(adminCookie, {
          email: `agent-list-${i}-${Date.now()}@test.com`,
          name: `List Agent ${i}`,
          role: 'agent',
          commissionSplit: '0.6500',
        });

        const dealRes = await createDeal(adminCookie, {
          agentId: agentRes.body.id,
          value: 100000000,
        });
        const dealId = dealRes.body.id;

        await advanceDealToContractPending(adminCookie, dealId);
        await request(app.getHttpServer())
          .post(`/api/deals/${dealId}/stage`)
          .set('Cookie', `access_token=${adminCookie}`)
          .send({ stage: 'closedWon' });
      }

      const listRes = await request(app.getHttpServer())
        .get('/api/commission-records')
        .set('Cookie', `access_token=${managerCookie}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(2);
    });
  });

  // ─── Precision Test ───────────────────────────────────

  describe('Precision', () => {
    it('$999,999.99 × 2.5% × 65% = exactly 1,625,000¢', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Precision 2.5%',
        type: 'percentage',
        rate: '0.0250',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-prec-${Date.now()}@test.com`,
        name: 'Precision Agent',
        role: 'agent',
        commissionSplit: '0.6500',
      });

      const dealRes = await createDeal(adminCookie, {
        agentId: agentRes.body.id,
        value: 99999999, // $999,999.99
      });
      const dealId = dealRes.body.id;

      await advanceDealToContractPending(adminCookie, dealId);
      await request(app.getHttpServer())
        .post(`/api/deals/${dealId}/stage`)
        .set('Cookie', `access_token=${adminCookie}`)
        .send({ stage: 'closedWon' });

      const [record] = await db
        .select()
        .from(commissionRecords)
        .where(eq(commissionRecords.dealId, dealId))
        .limit(1);

      expect(record.calculatedAmount).toBe(2_500_000);
      expect(record.agentPayoutAmount).toBe(1_625_000);
      expect(record.brokerageAmount).toBe(875_000);
    });
  });

  // ─── Summary Aggregation ──────────────────────────────

  describe('Summary aggregation', () => {
    it('GET /api/commission-records/summary returns matching sums', async () => {
      const { org, adminCookie } = await createOrgAndAdmin();

      const [plan] = await db.insert(commissionPlans).values({
        tenantId: org.id,
        name: 'Summary 5%',
        type: 'percentage',
        rate: '0.0500',
        isDefault: true,
      }).returning();

      const agentRes = await createUserAs(adminCookie, {
        email: `agent-summary-${Date.now()}@test.com`,
        name: 'Summary Agent',
        role: 'agent',
        commissionSplit: '0.5000',
      });

      // Create 3 deals and close them
      for (let i = 0; i < 3; i++) {
        const dealRes = await createDeal(adminCookie, {
          agentId: agentRes.body.id,
          value: 100000000, // $1M each
        });
        const dealId = dealRes.body.id;

        await advanceDealToContractPending(adminCookie, dealId);
        await request(app.getHttpServer())
          .post(`/api/deals/${dealId}/stage`)
          .set('Cookie', `access_token=${adminCookie}`)
          .send({ stage: 'closedWon' });
      }

      const summaryRes = await request(app.getHttpServer())
        .get('/api/commission-records/summary')
        .set('Cookie', `access_token=${adminCookie}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.count).toBe(3);
      // Each deal: base = round(100M × 0.05) = 5M, agent = floor(5M × 0.5) = 2.5M, brokerage = 2.5M
      expect(summaryRes.body.totalCalculated).toBe(15_000_000);
      expect(summaryRes.body.totalAgentPayout).toBe(7_500_000);
      expect(summaryRes.body.totalBrokerage).toBe(7_500_000);
    });
  });
});
