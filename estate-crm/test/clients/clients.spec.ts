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

describe('Clients Module (Phase 7)', () => {
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
      email: 'super@clients-test.com',
      passwordHash: hash,
      name: 'Clients Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@clients-test.com', password: 'super123!' });

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

  async function createClient(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        name: `Client ${ts}`,
        phone: `+20100${String(1000000 + (ts % 1000000)).padStart(7, '0')}`,
        type: 'buyer',
        ...overrides,
      });
    return res;
  }

  async function createLead(adminCookie: string, overrides: Record<string, unknown> = {}) {
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
        ...overrides,
      });
    return res;
  }

  // ─── CRUD Tests ────────────────────────────────────────

  it('POST /api/clients — Admin creates client with valid data (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await createClient(adminCookie);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toContain('Client');
    expect(res.body.isClient).toBe(true);
    expect(res.body.source).toBe('direct');
  });

  it('POST /api/clients — Agent can create client (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-create-${Date.now()}@test.com`,
      name: 'Create Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await createClient(agentCookie);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.isClient).toBe(true);
    expect(res.body.agentId).toBe(agentRes.body.id);
  });

  it('POST /api/clients — Missing required fields returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/clients — Duplicate phone returns warning (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const ts = Date.now();
    const phone = `+20100${String(1000000 + (ts % 1000000)).padStart(7, '0')}`;

    // Create first client
    const firstRes = await createClient(adminCookie, { phone });
    expect(firstRes.status).toBe(201);

    // Create second client with same phone
    const secondRes = await createClient(adminCookie, { phone, name: `Duplicate ${ts}` });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.duplicateWarning).toBeDefined();
    expect(secondRes.body.duplicateWarning.type).toBe('client');
    expect(secondRes.body.duplicateWarning.id).toBe(firstRes.body.id);
  });

  it('GET /api/clients — Admin lists clients with pagination', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    await createClient(adminCookie);
    await createClient(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/clients — Only clients are returned (isClient=true)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create a regular lead (isClient=false)
    await createLead(adminCookie);

    // Create a client (isClient=true)
    const clientRes = await createClient(adminCookie);
    const clientId = clientRes.body.id;

    const res = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    // Only the client should appear, not the lead
    for (const c of res.body.data) {
      expect(c.isClient).toBe(true);
    }
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(clientId);
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/clients — Agent sees only own clients', async () => {
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

    // Create 2 clients — one assigned to agent1, one to agent2
    await createClient(adminCookie, { agentId: agent1Res.body.id });
    await createClient(adminCookie, { agentId: agent2Id });

    // agent1 should see only 1 client
    const res = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', `access_token=${agent1Cookie}`);
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      expect(c.agentId).toBe(agent1Res.body.id);
    }
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/clients/:id — Get client by ID (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/clients/${clientId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(clientId);
    expect(res.body.isClient).toBe(true);
  });

  it('GET /api/clients/:id — Non-client lead returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create a regular lead (isClient=false)
    const leadRes = await createLead(adminCookie);
    const leadId = leadRes.body.id;

    // Try to fetch it via /api/clients/:id
    const res = await request(app.getHttpServer())
      .get(`/api/clients/${leadId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CLIENT_NOT_A_CLIENT');
  });

  it('PATCH /api/clients/:id — Update client name (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ name: 'Updated Client Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Client Name');
  });

  it('PATCH /api/clients/:id — Agent cannot set lifetimeValue (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-ltv-${Date.now()}@test.com`,
      name: 'LTV Agent',
      role: 'agent',
    });
    const agentId = agentRes.body.id;
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    // Create client assigned to this agent
    const createRes = await createClient(adminCookie, { agentId });
    const clientId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ lifetimeValue: 50000000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('DELETE /api/clients/:id — Soft delete client (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/clients/${clientId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', `access_token=${adminCookie}`);
    const ids = listRes.body.data.map((c: any) => c.id);
    expect(ids).not.toContain(clientId);
  });

  // ─── VIP Tests ─────────────────────────────────────────

  it('POST /api/clients/:id/vip — Set VIP as manager (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/vip`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isVip: true });
    expect(res.status).toBe(200);
    expect(res.body.isVip).toBe(true);
    expect(res.body.vipSetById).toBeDefined();
    expect(res.body.vipSetAt).toBeDefined();
  });

  it('POST /api/clients/:id/vip — Unset VIP (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    // Set VIP first
    await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/vip`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isVip: true });

    // Unset VIP
    const res = await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/vip`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isVip: false });
    expect(res.status).toBe(200);
    expect(res.body.isVip).toBe(false);
    expect(res.body.vipSetById).toBeNull();
    expect(res.body.vipSetAt).toBeNull();
  });

  it('POST /api/clients/:id/vip — Agent cannot set VIP (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-vip-${Date.now()}@test.com`,
      name: 'VIP Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const createRes = await createClient(adminCookie, { agentId: agentRes.body.id });
    const clientId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/vip`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ isVip: true });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST /api/clients/:id/vip — VIP on non-client lead returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create a regular lead (isClient=false)
    const leadRes = await createLead(adminCookie);
    const leadId = leadRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/clients/${leadId}/vip`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isVip: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CLIENT_NOT_A_CLIENT');
  });

  // ─── Lead Convert Tests ───────────────────────────────

  it('POST /api/leads/:id/convert — Converts lead to client (isClient=true, 200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    // Create an agent to assign the lead to
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-conv-${Date.now()}@test.com`,
      name: 'Convert Agent',
      role: 'agent',
    });
    const r = await createLead(adminCookie, { agentId: agentRes.body.id });
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/convert`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.isClient).toBe(true);
  });

  it('POST /api/leads/:id/convert — Already a client returns 400 LEAD_ALREADY_CLIENT', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-conv2-${Date.now()}@test.com`,
      name: 'Convert Agent 2',
      role: 'agent',
    });
    const r = await createLead(adminCookie, { agentId: agentRes.body.id });
    // Convert once
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/convert`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({});
    // Convert again
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/convert`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEAD_ALREADY_CLIENT');
  });

  // ─── Activity & Tag Tests ─────────────────────────────

  it('GET /api/clients/:id/activities — Returns activities for client (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    // Add an activity
    await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'Client call activity' });

    const res = await request(app.getHttpServer())
      .get(`/api/clients/${clientId}/activities`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].content).toBe('Client call activity');
  });

  it('GET /api/clients/:id/tags — Returns tags for client (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createClient(adminCookie);
    const clientId = createRes.body.id;

    // Add a tag
    await request(app.getHttpServer())
      .post(`/api/clients/${clientId}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'VIP', color: '#EF4444' });

    const res = await request(app.getHttpServer())
      .get(`/api/clients/${clientId}/tags`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tag).toBe('VIP');
  });
});
