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
import { superAdmins } from '@/db/schema';
import { hashPassword } from '@/common/utils/password';

describe('Organizations (Phase 3B)', () => {
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

  async function createOrgViaApi(overrides: Record<string, unknown> = {}) {
    const ts = Date.now();
    const body = {
      name: `Test Org ${ts}`,
      slug: `test-org-${ts}`,
      adminEmail: `admin-${ts}@test.com`,
      adminName: 'Test Admin',
      adminPassword: 'AdminPass123!',
      ...overrides,
    };
    const res = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set('Cookie', `access_token=${superAdminCookie}`)
      .send(body);
    return { res, body };
  }

  async function loginAsTenantAdmin(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    return extractAccessToken(res.headers['set-cookie']);
  }

  it('should create organization and admin user', async () => {
    const { res, body } = await createOrgViaApi();
    expect(res.status).toBe(201);
    expect(res.body.organization.name).toBe(body.name);
    expect(res.body.organization.slug).toBe(body.slug);
    expect(res.body.organization.status).toBe('active');
    expect(res.body.organization.plan).toBe('basic');
    expect(res.body.adminUser.email).toBe(body.adminEmail);
    expect(res.body.adminUser.role).toBe('admin');
    expect(res.body.commissionPlan.name).toBe('Default');
    expect(res.body.commissionPlan.isDefault).toBe(true);
  });

  it('should reject duplicate slug', async () => {
    const slug = `dup-slug-${Date.now()}`;
    await createOrgViaApi({ slug });
    const res = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set('Cookie', `access_token=${superAdminCookie}`)
      .send({
        name: 'Dup Org',
        slug,
        adminEmail: `other-${Date.now()}@test.com`,
        adminName: 'Other Admin',
        adminPassword: 'AdminPass123!',
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SLUG_EXISTS');
  });

  it('should reject duplicate admin email', async () => {
    const email = `dup-email-${Date.now()}@test.com`;
    await createOrgViaApi({ adminEmail: email });
    const res = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set('Cookie', `access_token=${superAdminCookie}`)
      .send({
        name: 'Dup Email Org',
        slug: `dup-email-${Date.now()}`,
        adminEmail: email,
        adminName: 'Other Admin',
        adminPassword: 'AdminPass123!',
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('should return organization details with user count', async () => {
    const { res: createRes, body: createBody } = await createOrgViaApi();
    const adminEmail = createBody.adminEmail;
    const adminPassword = createBody.adminPassword;
    const orgId = createRes.body.organization.id;

    const tenantCookie = await loginAsTenantAdmin(adminEmail, adminPassword);
    expect(tenantCookie).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Cookie', `access_token=${tenantCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orgId);
    expect(res.body.name).toBe(createBody.name);
    expect(res.body.slug).toBe(createBody.slug);
    expect(res.body.userCount).toBeGreaterThanOrEqual(1);
  });

  it('should list organizations with pagination', async () => {
    await createOrgViaApi({ slug: `page-a-${Date.now()}`, name: 'Page A' });
    await createOrgViaApi({ slug: `page-b-${Date.now()}`, name: 'Page B' });
    await createOrgViaApi({ slug: `page-c-${Date.now()}`, name: 'Page C' });

    const res = await request(app.getHttpServer())
      .get('/api/admin/organizations?page=1&limit=2')
      .set('Cookie', `access_token=${superAdminCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('should suspend organization and block tenant requests', async () => {
    const { res: createRes, body: createBody } = await createOrgViaApi();
    const orgId = createRes.body.organization.id;

    const tenantCookie = await loginAsTenantAdmin(createBody.adminEmail, createBody.adminPassword);
    expect(tenantCookie).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Cookie', `access_token=${tenantCookie}`);
    expect(meRes.status).toBe(200);

    const suspendRes = await request(app.getHttpServer())
      .post(`/api/admin/organizations/${orgId}/suspend`)
      .set('Cookie', `access_token=${superAdminCookie}`);
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.status).toBe('suspended');

    const blockedRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Cookie', `access_token=${tenantCookie}`);
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.code).toBe('TENANT_SUSPENDED');
  });

  it('should reactivate suspended organization', async () => {
    const { res: createRes, body: createBody } = await createOrgViaApi();
    const orgId = createRes.body.organization.id;

    await request(app.getHttpServer())
      .post(`/api/admin/organizations/${orgId}/suspend`)
      .set('Cookie', `access_token=${superAdminCookie}`);

    const activateRes = await request(app.getHttpServer())
      .post(`/api/admin/organizations/${orgId}/activate`)
      .set('Cookie', `access_token=${superAdminCookie}`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.status).toBe('active');

    const tenantCookie = await loginAsTenantAdmin(createBody.adminEmail, createBody.adminPassword);
    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Cookie', `access_token=${tenantCookie}`);
    expect(meRes.status).toBe(200);
  });

  it('should reject non-super-admin accessing admin endpoints', async () => {
    const { body: createBody } = await createOrgViaApi();
    const tenantCookie = await loginAsTenantAdmin(createBody.adminEmail, createBody.adminPassword);

    const res = await request(app.getHttpServer())
      .get('/api/admin/organizations')
      .set('Cookie', `access_token=${tenantCookie}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should delete organization', async () => {
    const { res: createRes } = await createOrgViaApi();
    const orgId = createRes.body.organization.id;

    const delRes = await request(app.getHttpServer())
      .delete(`/api/admin/organizations/${orgId}`)
      .set('Cookie', `access_token=${superAdminCookie}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app.getHttpServer())
      .get(`/api/admin/organizations/${orgId}`)
      .set('Cookie', `access_token=${superAdminCookie}`);
    expect(getRes.status).toBe(404);
  });

  it('should update organization', async () => {
    const { res: createRes } = await createOrgViaApi();
    const orgId = createRes.body.organization.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/admin/organizations/${orgId}`)
      .set('Cookie', `access_token=${superAdminCookie}`)
      .send({ name: 'Updated Name' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Name');
  });
});
