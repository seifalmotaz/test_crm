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

describe('Leads Module (Phase 6)', () => {
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
      email: 'super@leads-test.com',
      passwordHash: hash,
      name: 'Leads Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@leads-test.com', password: 'super123!' });

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

  it('POST /api/leads — Admin creates lead with valid data (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await createLead(adminCookie);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toContain('Lead');
    expect(res.body.stage).toBe('fresh');
    expect(res.body.isClient).toBe(false);
  });

  it('POST /api/leads — Missing required fields returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/leads — Agent cannot create lead (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Test Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Cookie', `access_token=${agentCookie}`)
      .send({
        name: 'Agent Lead',
        phone: '+201001234567',
        source: 'website',
        type: 'buyer',
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/leads — Admin lists leads with pagination', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    await createLead(adminCookie);
    await createLead(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/leads')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/leads?stage=qualified — Filter by stage', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r1 = await createLead(adminCookie);
    const r2 = await createLead(adminCookie);

    // Move r1 to qualified
    await request(app.getHttpServer())
      .post(`/api/leads/${r1.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'qualified' });

    const res = await request(app.getHttpServer())
      .get('/api/leads?stage=qualified')
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    for (const l of res.body.data) {
      expect(l.stage).toBe('qualified');
    }
    expect(res.body.data.find((l: any) => l.id === r2.body.id)).toBeUndefined();
  });

  it('GET /api/leads/:id — Get lead by ID', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createLead(adminCookie);
    const leadId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/leads/${leadId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(leadId);
  });

  it('PATCH /api/leads/:id — Update lead name', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createLead(adminCookie);
    const leadId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/leads/${leadId}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ name: 'Updated Name', notes: 'New notes' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.notes).toBe('New notes');
  });

  it('DELETE /api/leads/:id — Soft delete, excluded from list', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const createRes = await createLead(adminCookie);
    const leadId = createRes.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/leads/${leadId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/api/leads')
      .set('Cookie', `access_token=${adminCookie}`);
    const ids = listRes.body.data.map((l: any) => l.id);
    expect(ids).not.toContain(leadId);
  });

  // ─── Stage FSM Tests ───────────────────────────────────

  it('POST /api/leads/:id/stage — Valid fresh → qualified (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'qualified' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('qualified');
  });

  it('POST /api/leads/:id/stage — Valid backward qualified → fresh (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    // Move to qualified first
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'qualified' });
    // Then back to fresh
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'fresh' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('fresh');
  });

  it('POST /api/leads/:id/stage — Invalid fresh → reservation (skip) returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'reservation' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEAD_STAGE_INVALID');
  });

  it('POST /api/leads/:id/stage — lost is reachable from any stage (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'lost' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('lost');
  });

  it('POST /api/leads/:id/stage — Invalid stage value returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ stage: 'invalid-stage' });
    expect(res.status).toBe(400);
  });

  // ─── Conversion Tests ──────────────────────────────────

  it('POST /api/leads/:id/convert — Mark as converted (200)', async () => {
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

  it('POST /api/leads/:id/convert — Already converted returns 400', async () => {
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

  it('POST /api/leads/:id/convert — Unassigned lead returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    // Create lead with no agentId
    const r = await createLead(adminCookie, { agentId: undefined });
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/convert`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEAD_NOT_ASSIGNED');
  });

  // ─── DNC Tests ─────────────────────────────────────────

  it('POST /api/leads/:id/dnc — Set DNC (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/dnc`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isDnc: true, reason: 'Asked to stop' });
    expect(res.status).toBe(200);
    expect(res.body.isDnc).toBe(true);
    expect(res.body.dncReason).toBe('Asked to stop');
    expect(res.body.dncSetById).toBeDefined();
  });

  it('POST /api/leads/:id/dnc — Clear DNC (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    // Set first
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/dnc`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isDnc: true });
    // Clear
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/dnc`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isDnc: false });
    expect(res.status).toBe(200);
    expect(res.body.isDnc).toBe(false);
    expect(res.body.dncReason).toBeNull();
  });

  it('POST /api/leads/:id/dnc — Agent cannot toggle DNC (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-dnc-${Date.now()}@test.com`,
      name: 'DNC Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/dnc`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ isDnc: true });
    expect(res.status).toBe(403);
  });

  // ─── Activities Tests ──────────────────────────────────

  it('POST /api/leads/:id/activities — Add call activity (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'Initial call. Discussed budget.' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('call');
    expect(res.body.entityType).toBe('lead');
    expect(res.body.entityId).toBe(r.body.id);
  });

  it('GET /api/leads/:id/activities — Returns paginated activities sorted DESC', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    // Add 2 activities
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'First' });
    await new Promise((r) => setTimeout(r, 10));
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'note', content: 'Second' });

    const res = await request(app.getHttpServer())
      .get(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    // Most recent first
    expect(res.body.data[0].content).toBe('Second');
    expect(res.body.data[1].content).toBe('First');
  });

  it('POST /api/leads/:id/activities — DNC lead returns 403', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    // Set DNC
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/dnc`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ isDnc: true });

    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'call', content: 'Should be blocked' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LEAD_DNC_ACTIVE');
  });

  it('POST /api/leads/:id/activities — Invalid type returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ type: 'invalid-type', content: 'X' });
    expect(res.status).toBe(400);
  });

  // ─── Tags Tests ────────────────────────────────────────

  it('POST /api/leads/:id/tags — Add tag (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'Hot', color: '#EF4444' });
    expect(res.status).toBe(201);
    expect(res.body.tag).toBe('Hot');
    expect(res.body.color).toBe('#EF4444');
  });

  it('POST /api/leads/:id/tags — Duplicate tag returns 409', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'Hot', color: '#EF4444' });

    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'Hot', color: '#00FF00' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LEAD_TAG_DUPLICATE');
  });

  it('POST /api/leads/:id/tags — Invalid color returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'Hot', color: 'red' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/leads/:id/tags/:tagId — Remove tag (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const tagRes = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/tags`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ tag: 'Hot', color: '#EF4444' });
    const tagId = tagRes.body.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/leads/${r.body.id}/tags/${tagId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/leads/:id/tags/:tagId — Non-existent tag returns 404', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const fakeTagId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app.getHttpServer())
      .delete(`/api/leads/${r.body.id}/tags/${fakeTagId}`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LEAD_TAG_NOT_FOUND');
  });

  // ─── Agent Visibility Tests ────────────────────────────

  it('GET /api/leads — Agent sees only own leads', async () => {
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

    // Create 2 leads — one assigned to agent1, one to agent2
    await createLead(adminCookie, { agentId: agent1Res.body.id });
    await createLead(adminCookie, { agentId: agent2Id });

    // agent1 should see only 1 lead
    const res = await request(app.getHttpServer())
      .get('/api/leads')
      .set('Cookie', `access_token=${agent1Cookie}`);
    expect(res.status).toBe(200);
    for (const l of res.body.data) {
      expect(l.agentId).toBe(agent1Res.body.id);
    }
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/leads — Manager sees all leads in tenant', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Test Manager',
      role: 'manager',
    });
    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

    await createLead(adminCookie);
    await createLead(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/leads')
      .set('Cookie', `access_token=${managerCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/leads/:id — Agent cannot view another agent lead (403)', async () => {
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

    // Create lead assigned to agent1
    const r = await createLead(adminCookie, { agentId: agent1Id });

    // agent2 tries to get agent1's lead
    const res = await request(app.getHttpServer())
      .get(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${agent2Cookie}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/leads/:id — Agent can view own lead (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    // Create agent
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-own-self-${Date.now()}@test.com`,
      name: 'Self Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    // Create lead assigned to this agent
    const r = await createLead(adminCookie, { agentId: agentRes.body.id });

    // Agent views own lead
    const res = await request(app.getHttpServer())
      .get(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${agentCookie}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(r.body.id);
  });

  it('PATCH /api/leads/:id — Agent cannot update another agent lead (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-upd-1-${Date.now()}@test.com`,
      name: 'Upd Agent 1',
      role: 'agent',
    });
    const agent1Id = agent1Res.body.id;

    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-upd-2-${Date.now()}@test.com`,
      name: 'Upd Agent 2',
      role: 'agent',
    });
    const agent2Cookie = await loginAs(agent2Res.body.email, 'AdminPass123!');

    // Create lead assigned to agent1
    const r = await createLead(adminCookie, { agentId: agent1Id });

    // agent2 tries to update agent1's lead
    const res = await request(app.getHttpServer())
      .patch(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${agent2Cookie}`)
      .send({ name: 'Hacked name' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST /api/leads/:id/activities — Agent cannot add activity to another agent lead (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-act-1-${Date.now()}@test.com`,
      name: 'Act Agent 1',
      role: 'agent',
    });
    const agent1Id = agent1Res.body.id;

    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-act-2-${Date.now()}@test.com`,
      name: 'Act Agent 2',
      role: 'agent',
    });
    const agent2Cookie = await loginAs(agent2Res.body.email, 'AdminPass123!');

    // Create lead assigned to agent1
    const r = await createLead(adminCookie, { agentId: agent1Id });

    // agent2 tries to add activity to agent1's lead
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/activities`)
      .set('Cookie', `access_token=${agent2Cookie}`)
      .send({ type: 'call', content: 'Should be blocked' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST /api/leads/:id/stage — Agent cannot change stage on another agent lead (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-stg-1-${Date.now()}@test.com`,
      name: 'Stg Agent 1',
      role: 'agent',
    });
    const agent1Id = agent1Res.body.id;

    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-stg-2-${Date.now()}@test.com`,
      name: 'Stg Agent 2',
      role: 'agent',
    });
    const agent2Cookie = await loginAs(agent2Res.body.email, 'AdminPass123!');

    // Create lead assigned to agent1
    const r = await createLead(adminCookie, { agentId: agent1Id });

    // agent2 tries to change stage on agent1's lead
    const res = await request(app.getHttpServer())
      .post(`/api/leads/${r.body.id}/stage`)
      .set('Cookie', `access_token=${agent2Cookie}`)
      .send({ stage: 'qualified' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/leads — Cross-tenant lead is not visible', async () => {
    const { adminCookie: adminA } = await createOrgAndAdmin();
    const { adminCookie: adminB } = await createOrgAndAdmin();

    const r = await createLead(adminA);

    // adminB should not see r
    const res = await request(app.getHttpServer())
      .get(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${adminB}`);
    expect(res.status).toBe(404);
  });

  // ─── Assignment Tests ──────────────────────────────────

  it('PATCH /api/leads/:id — Reassign agent, appends to previousAgentIds', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agent1Res = await createUserAs(adminCookie, {
      email: `agent-as-1-${Date.now()}@test.com`,
      name: 'Assign Agent 1',
      role: 'agent',
    });
    const agent2Res = await createUserAs(adminCookie, {
      email: `agent-as-2-${Date.now()}@test.com`,
      name: 'Assign Agent 2',
      role: 'agent',
    });

    const r = await createLead(adminCookie, { agentId: agent1Res.body.id });

    // Reassign
    const res = await request(app.getHttpServer())
      .patch(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ agentId: agent2Res.body.id });
    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe(agent2Res.body.id);
    expect(res.body.previousAgentIds).toContain(agent1Res.body.id);
  });

  // ─── Score Tests ───────────────────────────────────────

  it('PATCH /api/leads/:id — Agent cannot set score (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const agentRes = await createUserAs(adminCookie, {
      email: `agent-score-${Date.now()}@test.com`,
      name: 'Score Agent',
      role: 'agent',
    });
    const agentId = agentRes.body.id;
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    // Create lead assigned to this agent
    const r = await createLead(adminCookie, { agentId });

    const res = await request(app.getHttpServer())
      .patch(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ score: 99 });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/leads/:id — Manager can set score (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const r = await createLead(adminCookie);
    const res = await request(app.getHttpServer())
      .patch(`/api/leads/${r.body.id}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ score: 88 });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(88);
  });
});
