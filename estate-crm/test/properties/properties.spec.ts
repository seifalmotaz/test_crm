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

describe('Properties Module (Phase 5)', () => {
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
      email: 'super@properties-test.com',
      passwordHash: hash,
      name: 'Properties Test Super Admin',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'super@properties-test.com', password: 'super123!' });

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

  async function createProject(adminCookie: string) {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        name: `Project ${Date.now()}`,
        location: 'Downtown',
        status: 'planning',
      });
    return res.body;
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
        beds: 2,
        baths: 2,
        sqft: 1500,
        attributes: {
          floorNumber: 3,
          totalFloors: 10,
          amenities: ['pool', 'gym'],
          furnishing: 'fully',
          hasElevator: true,
          hasGenerator: true,
        },
        ...overrides,
      });
    return res;
  }

  // ─── CRUD Tests ────────────────────────────────────────

  it('POST /api/properties — Admin creates property with valid apartment attributes (201)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const res = await createProperty(adminCookie);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBeDefined();
    expect(res.body.type).toBe('apartment');
    expect(res.body.attributes.floorNumber).toBe(3);
  });

  it('POST /api/properties — Missing required attributes for apartment returns 400', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`)
      .send({
        title: 'Bad Apartment',
        address: '123 Test St',
        type: 'apartment',
        price: 250000,
        attributes: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/properties — Agent cannot create property (403)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Test Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Cookie', `access_token=${agentCookie}`)
      .send({
        title: 'Agent Property',
        address: '123 Test St',
        type: 'apartment',
        price: 250000,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/properties — Admin lists properties with pagination', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    await createProperty(adminCookie);
    await createProperty(adminCookie);

    const res = await request(app.getHttpServer())
      .get('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
  });

  it('GET /api/properties?type=apartment — List filtered by type returns only apartments', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    await createProperty(adminCookie, { type: 'apartment', title: `Apt ${Date.now()}` });
    await createProperty(adminCookie, { type: 'villa', title: `Villa ${Date.now()}`, attributes: { plotSize: 500, builtUpArea: 300, hasPool: true } });

    const res = await request(app.getHttpServer())
      .get('/api/properties?type=apartment')
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    for (const prop of res.body.data) {
      expect(prop.type).toBe('apartment');
    }
  });

  it('GET /api/properties/:id — Get property by ID', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie);
    const propertyId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(propertyId);
  });

  it('PATCH /api/properties/:id — Update property price', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie);
    const propertyId = createRes.body.id;
    const newPrice = 350000;

    const res = await request(app.getHttpServer())
      .patch(`/api/properties/${propertyId}`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ price: newPrice });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(newPrice);
  });

  // ─── Status Transitions ────────────────────────────────

  it('POST /api/properties/:id/status — Valid transition active → pending (200)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie, { status: 'active' });
    const propertyId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('POST /api/properties/:id/status — Forbidden transition active → sold (400)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie, { status: 'active' });
    const propertyId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/status`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ status: 'sold' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PROPERTY_STATUS_CONFLICT');
  });

  it('POST /api/properties/:id/status — Agent cannot change status (403)', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie, { status: 'active' });
    const propertyId = createRes.body.id;

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Status Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/status`)
      .set('Cookie', `access_token=${agentCookie}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  // ─── Soft Delete ───────────────────────────────────────

  it('DELETE /api/properties/:id — Soft delete property, excluded from list', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie);
    const propertyId = createRes.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/properties/${propertyId}`)
      .set('Cookie', `access_token=${adminCookie}`);

    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/api/properties')
      .set('Cookie', `access_token=${adminCookie}`);

    const ids = listRes.body.data.map((p: any) => p.id);
    expect(ids).not.toContain(propertyId);
  });

  // ─── Agent Visibility ──────────────────────────────────

  it('GET /api/properties — Agent sees all properties (read-only visibility)', async () => {
    const { org, adminCookie } = await createOrgAndAdmin();

    await createProperty(adminCookie);
    await createProperty(adminCookie);

    const agentRes = await createUserAs(adminCookie, {
      email: `agent-${Date.now()}@test.com`,
      name: 'Visibility Agent',
      role: 'agent',
    });
    const agentCookie = await loginAs(agentRes.body.email, 'AdminPass123!');

    const res = await request(app.getHttpServer())
      .get('/api/properties')
      .set('Cookie', `access_token=${agentCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  // ─── Media Pre-Signed URL ──────────────────────────────

  it('POST /api/properties/:id/media — Generate pre-signed upload URL', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const createRes = await createProperty(adminCookie);
    const propertyId = createRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/media`)
      .set('Cookie', `access_token=${adminCookie}`)
      .send({ filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.fileUrl).toBeDefined();
    expect(res.body.uploadUrl.startsWith('https://')).toBe(true);
    expect(res.body.fileUrl.startsWith('https://')).toBe(true);
  });

  // ─── Create with Project ───────────────────────────────

  it('POST /api/properties — Create property with projectId links to project', async () => {
    const { adminCookie } = await createOrgAndAdmin();

    const project = await createProject(adminCookie);
    const projectId = project.id;

    const res = await createProperty(adminCookie, { projectId });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(projectId);
  });
});