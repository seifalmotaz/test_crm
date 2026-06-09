import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import { AppModule } from '@/app.module';
import { createTestApp } from '../helpers/test-app';
import { truncateAllWithOrg } from '../helpers/db-cleanup';
import { extractAccessToken } from '../helpers/auth-helper';
import { db } from '@/db/connection';
import { redis } from '@/db/redis';
import { users, leads, auditLogs } from '@/db/schema';
import { hashPassword } from '@/common/utils/password';
import { superAdmins } from '@/db/schema';

describe('Users Module (Phase 1 — TDD)', () => {
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
      email: 'super@admin.com',
      passwordHash: hash,
      name: 'Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@admin.com', password: 'super123!' });

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

    return { org, adminCookie, adminEmail: body.adminEmail, adminPassword: body.adminPassword };
  }

  async function createUserAs(creatorCookie: string, dto: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Cookie', `access_token=${creatorCookie}`)
      .send(dto);
    return res;
  }

  async function createLeadForAgent(tenantId: string, agentId: string, stage = 'fresh') {
    const [lead] = await db
      .insert(leads)
      .values({
        tenantId,
        name: `Lead ${Date.now()}`,
        email: `lead-${Date.now()}@test.com`,
        phone: '555-0100',
        source: 'referral',
        type: 'buyer',
        stage,
        agentId,
      })
      .returning();
    return lead;
  }

  async function loginAs(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    return extractAccessToken(res.headers['set-cookie'])!;
  }

  // ─── GET /api/users visibility ─────────────────────────

  it('GET /api/users — Admin sees all users in org', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Manager One',
      role: 'manager',
    });
    expect(managerRes.status).toBe(201);

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent One',
      role: 'agent',
    });
    expect(agentRes.status).toBe(201);

    const listRes = await request(app.getHttpServer())
      .get('/api/users?limit=100')
      .set('Cookie', `access_token=${adminCookie}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((u: any) => u.id);
    expect(ids).toContain(managerRes.body.id);
    expect(ids).toContain(agentRes.body.id);
  });

  it('GET /api/users — Manager sees only agents', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Manager One',
      role: 'manager',
    });

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent One',
      role: 'agent',
    });

    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

    const listRes = await request(app.getHttpServer())
      .get('/api/users?limit=100')
      .set('Cookie', `access_token=${managerCookie}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((u: any) => u.id);
    expect(ids).toContain(agentRes.body.id);
    expect(ids).not.toContain(managerRes.body.id);
  });

  it('GET /api/users — Agent sees only self', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent One',
      role: 'agent',
    });

    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const listRes = await request(app.getHttpServer())
      .get('/api/users?limit=100')
      .set('Cookie', `access_token=${agentCookie}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(agentRes.body.id);
  });

  // ─── POST /api/users creation ──────────────────────────

  it('POST /api/users — Admin creates manager', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const res = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'New Manager',
      role: 'manager',
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBeDefined();
    expect(res.body.role).toBe('manager');
  });

  it('POST /api/users — Admin creates agent with commission split', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const res = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'New Agent',
      role: 'agent',
      commissionSplit: 0.7,
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('agent');
    expect(res.body.commissionSplit).toBe('0.7000');
  });

  it('POST /api/users — Manager creates agent (success)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Manager One',
      role: 'manager',
    });

    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

    const res = await createUserAs(managerCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent By Manager',
      role: 'agent',
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('agent');
  });

  it('POST /api/users — Manager cannot create manager (403)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const managerRes = await createUserAs(adminCookie, {
      email: `manager-${Date.now()}@test.com`,
      name: 'Manager One',
      role: 'manager',
    });

    const managerCookie = await loginAs(managerRes.body.email, 'AdminPass123!');

    const res = await createUserAs(managerCookie, {
      email: `manager2-${Date.now()}@test.com`,
      name: 'Manager Two',
      role: 'manager',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST /api/users — Agent cannot create user (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent One',
      role: 'agent',
    });

    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await createUserAs(agentCookie, {
      email: `newuser-${Date.now()}@test.com`,
      name: 'Should Fail',
      role: 'agent',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST /api/users — Duplicate email in same tenant (409 USER_ALREADY_EXISTS)', async () => {
    const { adminCookie } = await createOrgAndAdmin();
    const email = `dup-${Date.now()}@test.com`;

    const first = await createUserAs(adminCookie, {
      email,
      name: 'First User',
      role: 'agent',
    });
    expect(first.status).toBe(201);

    const second = await createUserAs(adminCookie, {
      email,
      name: 'Second User',
      role: 'agent',
    });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('USER_ALREADY_EXISTS');
  });

  // ─── GET /api/users/:id ────────────────────────────────

  it('GET /api/users/:id — Get user details', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const userRes = await createUserAs(adminCookie, {
      email: `user-${Date.now()}@test.com`,
      name: 'Detail User',
      role: 'agent',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/users/${userRes.body.id}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userRes.body.id);
    expect(res.body.email).toBe(userRes.body.email);
  });

  // ─── PATCH /api/users/:id ──────────────────────────────

  it('PATCH /api/users/:id — Update user name and email', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const userRes = await createUserAs(adminCookie, {
      email: `user-${Date.now()}@test.com`,
      name: 'Old Name',
      role: 'agent',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${userRes.body.id}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ name: 'Updated Name', email: `updated-${Date.now()}@test.com` });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  // ─── PATCH /api/users/:id/role ─────────────────────────

  it('PATCH /api/users/:id/role — Change role (admin changes agent to manager)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Promotable Agent',
      role: 'agent',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${agentRes.body.id}/role`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ role: 'manager' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('manager');
  });

  it('PATCH /api/users/:id/role — Cannot downgrade last admin (400 LAST_ADMIN)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    // Org has only one admin. Try to change admin to manager.
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, org.id), eq(users.role, 'admin')))
      .limit(1);

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${adminUser.id}/role`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ role: 'manager' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LAST_ADMIN');
  });

  // ─── POST /api/users/:id/deactivate ──────────────────

  it('POST /api/users/:id/deactivate — Deactivate agent, verify status=inactive, leads unassigned', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent To Deactivate',
      role: 'agent',
    });
    const agentId = agentRes.body.id;

    const lead = await createLeadForAgent(org.id, agentId, 'fresh');

    const res = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');

    const [updatedLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, lead.id));

    expect(updatedLead.agentId).toBeNull();
    expect(updatedLead.previousAgentIds).toContain(agentId);
  });

  it('POST /api/users/:id/deactivate — Verify reservation-stage leads are NOT unassigned', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent With Reservations',
      role: 'agent',
    });
    const agentId = agentRes.body.id;

    const reservationLead = await createLeadForAgent(org.id, agentId, 'reservation');

    const res = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);

    const [updatedLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, reservationLead.id));

    expect(updatedLead.agentId).toBe(agentId);
  });

  it('POST /api/users/:id/deactivate — Cannot deactivate last admin (400 LAST_ADMIN)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, org.id), eq(users.role, 'admin')))
      .limit(1);

    const res = await request(app.getHttpServer())
      .post(`/api/users/${adminUser.id}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LAST_ADMIN');
  });

  it('POST /api/users/:id/deactivate — Cannot deactivate self (400 CANNOT_DEACTIVATE_SELF)', async () => {
    const { org, adminCookie, adminEmail, adminPassword } = await createOrgAndAdmin();

    // Create a second admin so we don't hit LAST_ADMIN
    const secondAdminRes = await createUserAs(adminCookie, {
      email: `admin2-${Date.now()}@test.com`,
      name: 'Second Admin',
      role: 'admin',
    });
    expect(secondAdminRes.status).toBe(201);

    const firstAdminCookie = await loginAs(adminEmail, adminPassword);

    const [firstAdmin] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, org.id), eq(users.email, adminEmail)))
      .limit(1);

    const res = await request(app.getHttpServer())
      .post(`/api/users/${firstAdmin.id}/deactivate`)
      .set('Cookie', `access_token=${firstAdminCookie}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('POST /api/users/:id/activate — Reactivate departed agent, verify status=active, departedAt cleared', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Agent To Reactivate',
      role: 'agent',
    });
    const agentId = agentRes.body.id;

    // Deactivate first
    const deactivateRes = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(deactivateRes.status).toBe(200);

    // Verify departedAt is set
    const [inactiveUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, agentId));
    expect(inactiveUser.status).toBe('inactive');
    expect(inactiveUser.departedAt).toBeTruthy();

    // Reactivate
    const res = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/activate`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const [reactivatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, agentId));
    expect(reactivatedUser.departedAt).toBeNull();
  });

  it('POST /api/users/:id/deactivate — Already inactive user (400 ALREADY_INACTIVE)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Already Inactive Agent',
      role: 'agent',
    });
    const agentId = agentRes.body.id;

    const first = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(second.status).toBe(400);
    expect(second.body.code).toBe('ALREADY_INACTIVE');
  });

  // ─── Audit logs ────────────────────────────────────────

  it('Verify audit log entries are created on role change and deactivation', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Audit Agent',
      role: 'agent',
    });
    const agentId = agentRes.body.id;

    // Role change
    await request(app.getHttpServer())
      .patch(`/api/users/${agentId}/role`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ role: 'manager' });

    // Deactivation
    await request(app.getHttpServer())
      .post(`/api/users/${agentId}/deactivate`)
      .set('Cookie', `access_token=${adminCookie}`);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, org.id), eq(auditLogs.targetId, agentId)))
      .orderBy(auditLogs.createdAt);

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('role_change');
    expect(actions).toContain('user_deactivate');
  });
});
