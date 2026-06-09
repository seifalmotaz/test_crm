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

describe('Projects Module (Phase 5)', () => {
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
      email: 'super@projects-test.com',
      passwordHash: hash,
      name: 'Projects Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@projects-test.com', password: 'super123!' });

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

  async function createProject(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        name: `Project ${ts}`,
        location: 'Downtown',
        ...overrides,
      });
    return res;
  }

  async function createProperty(adminCookie: string, overrides: Record<string, unknown> = {}) {
    const ts = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        title: `Property ${ts}`,
        address: `123 Test St ${ts}`,
        type: 'apartment',
        price: 250000,
        attributes: { floorNumber: 1, totalFloors: 5 },
        ...overrides,
      });
    return res;
  }

  // ─── CRUD Tests ────────────────────────────────────────

  it('POST /api/projects — Admin creates project (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const res = await createProject(adminCookie);

    expect(res.status).toBe(201);
    expect(res.body.name).toBeDefined();
    expect(res.body.status).toBe('planning');
  });

  it('POST /api/projects — Agent cannot create project (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Test Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', `access_token=${agentCookie}`)
      .send({
        name: 'Agent Project',
        location: 'Downtown',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/projects — Admin lists projects with pagination', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    await createProject(adminCookie);
    await createProject(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
  });

  it('GET /api/projects/:id — Get project by ID', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(projectId);
  });

  it('PATCH /api/projects/:id — Update project name', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;
    const newName = `Updated Project ${Date.now()}`;

    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ name: newName });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
  });

  // ─── Status Transitions ────────────────────────────────

  it('POST /api/projects/:id/status — Valid transition planning → active (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('POST /api/projects/:id/status — Valid transition planning → preLaunch (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'preLaunch' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('preLaunch');
  });

  it('POST /api/projects/:id/status — Invalid transition active → planning (400)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    // Move to active first
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'active' });

    // Try to go back to planning (invalid)
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'planning' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PROJECT_STATUS_INVALID');
  });

  it('POST /api/projects/:id/status — Agent cannot change project status (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Status Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/status`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ status: 'active' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  // ─── Soft Delete ───────────────────────────────────────

  it('DELETE /api/projects/:id — Soft delete project, excluded from list', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/api/projects')
      .set('Cookie', `access_token=${adminCookie}`);

    const ids = listRes.body.data.map((p: any) => p.id);
    expect(ids).not.toContain(projectId);
  });

  // ─── Cross-Entity: Project + Properties ────────────────

  it('GET /api/properties?projectId=xxx — List properties within a project', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProject(adminCookie);
    const projectId = createRes.body.id;

    await createProperty(adminCookie, { projectId });
    await createProperty(adminCookie, { projectId });

    const res = await request(app.getHttpServer())
      .get(`/api/properties?projectId=${projectId}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    for (const prop of res.body.data) {
      expect(prop.projectId).toBe(projectId);
    }
  });
});