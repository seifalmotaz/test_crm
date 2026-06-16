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
import { superAdmins } from '@/db/schema';

describe('Deals Module (Phase 6)', () => {
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
      email: 'super@deals-test.com',
      passwordHash: hash,
      name: 'Deals Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@deals-test.com', password: 'super123!' });

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

  async function createProperty(adminCookie: string) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        title: `Property ${ts}`,
        address: `${ts} Main St`,
        type: 'apartment',
        price: 25000000,
      });
    return res;
  }

  async function createLeadAs(adminCookie: string) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        name: `Lead ${ts}`,
        email: `lead${ts}@example.com`,
        phone: `+20100${String(1000000 + (ts % 1000000)).padStart(7, '0')}`,
        source: 'website',
        type: 'buyer',
        budgetMin: 10000000,
        budgetMax: 30000000,
      });
    return res;
  }

  async function createDeal(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();

    // Create property if not provided
    let propertyId = overrides.propertyId as string | undefined;
    if (!propertyId) {
      const propRes = await createProperty(adminCookie);
      propertyId = propRes.body.id;
    }

    // Create agent if not provided
    let agentId = overrides.agentId as string | undefined;
    if (!agentId) {
      const agentRes = await createUserAs(adminCookie, {
        email: `agent-deal-${ts}@test.com`,
        name: 'Deal Agent',
        role: 'agent',
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
        value: 45000000,
        ...overrides,
      });
    return res;
  }

  // ─── CRUD Tests ────────────────────────────────────────

  it('POST /api/deals — Admin creates deal with valid data (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await createDeal(adminCookie);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe('standard');
    expect(res.body.value).toBe(45000000);
    expect(res.body.stage).toBe('initialContact');
    expect(res.body.probability).toBe(50);
  });

  it('POST /api/deals — Missing required fields returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'standard' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/deals — Without propertyId AND leadId returns 400 VALIDATION_ERROR', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-noprop-${ts}@test.com`,
      name: 'No Prop Agent',
      role: 'agent',
    });

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        agentId: agentRes.body.id,
        type: 'standard',
        value: 45000000,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/deals — Agent cannot create deal (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-create-${Date.now()}@test.com`,
      name: 'Create Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${agentCookie}`)
      .send({
        agentId: agentRes.body.id,
        type: 'standard',
        value: 45000000,
        propertyId: '00000000-0000-0000-0000-000000000001',
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/deals — Admin lists deals with pagination', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    await createDeal(adminCookie);
    await createDeal(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/deals?stage=initialContact — Filter by stage', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    await createDeal(adminCookie);
    await createDeal(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/deals?stage=initialContact')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    for (const d of res.body.data) {
      expect(d.stage).toBe('initialContact');
    }
  });

  it('GET /api/deals/:id — Get deal by ID', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createDeal(adminCookie);
    const dealId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/deals/${dealId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(dealId);
  });

  it('PATCH /api/deals/:id — Update deal notes', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createDeal(adminCookie);
    const dealId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ notes: 'Updated notes for this deal' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated notes for this deal');
  });

  it('PATCH /api/deals/:id — Agent cannot set deal probability (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-prob-${ts}@test.com`,
      name: 'Prob Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');
    const r = await createDeal(adminCookie, { agentId: agentRes.body.id });

    const res = await request(app.getHttpServer())
      .patch(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ probability: 90 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/deals/:id — Agent cannot set deal value (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-val-${ts}@test.com`,
      name: 'Val Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');
    const r = await createDeal(adminCookie, { agentId: agentRes.body.id });

    const res = await request(app.getHttpServer())
      .patch(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ value: 50000000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/deals/:id — Manager can set probability and value (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);

    const res = await request(app.getHttpServer())
      .patch(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ probability: 75, value: 55000000 });
    expect(res.status).toBe(200);
    expect(res.body.probability).toBe(75);
    expect(res.body.value).toBe(55000000);
  });

  it('DELETE /api/deals/:id — Soft delete, excluded from list', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createDeal(adminCookie);
    const dealId = createRes.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/deals/${dealId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`);
    const ids = listRes.body.data.map((d: any) => d.id);
    expect(ids).not.toContain(dealId);
  });

  // ─── Stage FSM Tests ───────────────────────────────────

  it('POST /api/deals/:id/stage — Valid initialContact → negotiation (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('negotiation');
  });

  it('POST /api/deals/:id/stage — Valid negotiation → contractPending (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    // Move to negotiation first
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    // Then to contractPending
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('contractPending');
  });

  it('POST /api/deals/:id/stage — Valid contractPending → closedWon by manager (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    // Move to contractPending
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
    // Manager closes as won
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'closedWon' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('closedWon');
  });

  it('POST /api/deals/:id/stage — Valid initialContact → closedLost by agent (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-lost-${ts}@test.com`,
      name: 'Lost Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');
    const r = await createDeal(adminCookie, { agentId: agentRes.body.id });

    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ stage: 'closedLost' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('closedLost');
  });

  it('POST /api/deals/:id/stage — Invalid initialContact → closedWon (skip stages) returns 400 DEAL_STAGE_INVALID', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'closedWon' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEAL_STAGE_INVALID');
  });

  it('POST /api/deals/:id/stage — Invalid initialContact → contractPending (skip) returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEAL_STAGE_INVALID');
  });

  it('POST /api/deals/:id/stage — Agent closing to closedWon returns 403 DEAL_CLOSING_LOCKED', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-close-${ts}@test.com`,
      name: 'Close Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');
    const r = await createDeal(adminCookie, { agentId: agentRes.body.id });

    // Move to contractPending first (admin does this)
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });

    // Agent tries to close as won
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ stage: 'closedWon' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEAL_CLOSING_LOCKED');
  });

  it('POST /api/deals/:id/stage — Manager closing to closedWon returns 200', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const managerRes = await createUserAs(adminCookie, {
      email: `manager-close-${ts}@test.com`,
      name: 'Close Manager',
      role: 'manager',
    });
    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');
    const r = await createDeal(adminCookie, { agentId: managerRes.body.id });

    // Move to contractPending
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${managerCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${managerCookie}`)
      .send({ stage: 'contractPending' });

    // Manager closes as won
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${managerCookie}`)
      .send({ stage: 'closedWon' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('closedWon');
  });

  it('POST /api/deals/:id/stage — Invalid stage value returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'invalid-stage' });
    expect(res.status).toBe(400);
  });

  it('POST /api/deals/:id/stage — Terminal stage closedWon has no outgoing transitions (400)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    // Move to closedWon
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'closedWon' });

    // Try to transition from terminal
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEAL_STAGE_INVALID');
  });

  it('POST /api/deals/:id/stage — Closing sets closingDate', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    // Move to closedWon
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'negotiation' });
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'contractPending' });
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'closedWon' });
    expect(res.status).toBe(200);
    expect(res.body.closingDate).toBeTruthy();
  });

  // ─── Visibility Tests ──────────────────────────────────

  it('GET /api/deals — Agent sees only own deals', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create 2 agents
    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-vis-1-${Date.now()}@test.com`,
      name: 'Vis Agent 1',
      role: 'agent',
    });
    const agent1Cookie = await loginAs(agent1Res.body.email, 'AdminPass123!');

    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-vis-2-${Date.now()}@test.com`,
      name: 'Vis Agent 2',
      role: 'agent',
    });
    const agent2Id = agent2Res.body.id;

    // Create 2 deals — one assigned to agent1, one to agent2
    await createDeal(adminCookie, { agentId: agent1Res.body.id });
    await createDeal(adminCookie, { agentId: agent2Id });

    // agent1 should see only 1 deal
    const res = await request(app.getHttpServer())
      .get('/api/deals')
      .set('Cookie', `access_token=${agent1Cookie}`);
    expect(res.status).toBe(200);
    for (const d of res.body.data) {
      expect(d.agentId).toBe(agent1Res.body.id);
    }
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/deals — Manager sees all deals in tenant', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Test Manager',
      role: 'manager',
    });
    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

    await createDeal(adminCookie);
    await createDeal(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/deals')
      .set('Cookie', `access_token=${managerCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/deals/:id — Agent cannot view another agent deal (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create 2 agents
    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-own-1-${Date.now()}@test.com`,
      name: 'Own Agent 1',
      role: 'agent',
    });
    const agent1Id = agent1Res.body.id;

    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-own-2-${Date.now()}@test.com`,
      name: 'Own Agent 2',
      role: 'agent',
    });
    const agent2Cookie = await loginAs(agent2Res.body.email, 'AdminPass123!');

    // Create deal assigned to agent1
    const r = await createDeal(adminCookie, { agentId: agent1Id });

    // agent2 tries to get agent1's deal
    const res = await request(app.getHttpServer())
      .get(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${agent2Cookie}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/deals/:id — Agent can view own deal (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create agent
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-own-self-${Date.now()}@test.com`,
      name: 'Self Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    // Create deal assigned to this agent
    const r = await createDeal(adminCookie, { agentId: agentRes.body.id });

    // Agent views own deal
    const res = await request(app.getHttpServer())
      .get(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${agentCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(r.body.id);
  });

  it('GET /api/deals/:id — Cross-tenant deal is not visible', async () => {
    const { adminCookie: adminA } = await createOrgAndAdmin();
    const { adminCookie: adminB } = await createOrgAndAdmin();

    const r = await createDeal(adminA);

    // adminB should not see r
    const res = await request(app.getHttpServer())
      .get(`/api/deals/${r.body.id}`)
      .set('Cookie', `access_token=${adminB}`);
    expect(res.status).toBe(404);
  });

  // ─── Activities Tests ──────────────────────────────────

  it('POST /api/deals/:id/activities — Add call activity (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'Initial call. Discussed budget.' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('call');
    expect(res.body.entityType).toBe('deal');
    expect(res.body.entityId).toBe(r.body.id);
  });

  it('GET /api/deals/:id/activities — Returns paginated activities sorted DESC', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    // Add 2 activities
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'First' });
    await new Promise((r) => setTimeout(r, 10));
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'note', content: 'Second' });

    const res = await request(app.getHttpServer())
      .get(`/api/deals/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    // Most recent first
    expect(res.body.data[0].content).toBe('Second');
    expect(res.body.data[1].content).toBe('First');
  });

  it('POST /api/deals/:id/activities — Invalid type returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'invalid-type', content: 'X' });
    expect(res.status).toBe(400);
  });

  // ─── Tags Tests ────────────────────────────────────────

  it('POST /api/deals/:id/tags — Add tag (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'VIP', color: '#EF4444' });
    expect(res.status).toBe(201);
    expect(res.body.tag).toBe('VIP');
    expect(res.body.color).toBe('#EF4444');
  });

  it('POST /api/deals/:id/tags — Duplicate tag returns 409', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'VIP', color: '#EF4444' });

    const res = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'VIP', color: '#00FF00' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEAL_TAG_DUPLICATE');
  });

  it('DELETE /api/deals/:id/tags/:tagId — Remove tag (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const tagRes = await request(app.getHttpServer())
      .post(`/api/deals/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'VIP', color: '#EF4444' });
    const tagId = tagRes.body.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/deals/${r.body.id}/tags/${tagId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/deals/:id/tags/:tagId — Non-existent tag returns 404', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createDeal(adminCookie);
    const fakeTagId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app.getHttpServer())
      .delete(`/api/deals/${r.body.id}/tags/${fakeTagId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DEAL_TAG_NOT_FOUND');
  });

  // ─── Property Linkage Tests ────────────────────────────

  it('POST /api/deals — Creating deal with non-existent propertyId returns 404', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-badprop-${ts}@test.com`,
      name: 'Bad Prop Agent',
      role: 'agent',
    });

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        agentId: agentRes.body.id,
        propertyId: '00000000-0000-0000-0000-000000000000',
        type: 'standard',
        value: 45000000,
      });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROPERTY_NOT_FOUND');
  });

  // ─── Lead Linkage Tests ────────────────────────────────

  it('POST /api/deals — Creating deal with non-existent leadId returns 404', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-badlead-${ts}@test.com`,
      name: 'Bad Lead Agent',
      role: 'agent',
    });
    const propRes = await createProperty(adminCookie);

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        agentId: agentRes.body.id,
        propertyId: propRes.body.id,
        leadId: '00000000-0000-0000-0000-000000000000',
        type: 'standard',
        value: 45000000,
      });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LEAD_NOT_FOUND');
  });
});
