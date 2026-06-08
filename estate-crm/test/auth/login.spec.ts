import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '@/auth/auth.module';
import { createTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/db-cleanup';
import { createTestOrg, createTestUser } from '../helpers/auth-helper';
import { db } from '@/db/connection';
import { redis } from '@/db/redis';

describe('Login', () => {
  let app: INestApplication;
  let orgId: string;
  let userEmail: string;
  let plainPassword: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = await createTestApp(module);
    await truncateAll(db);

    const org = await createTestOrg({ slug: `login-test-${Date.now()}` });
    orgId = org.id;

    userEmail = `login-user-${Date.now()}@example.com`;
    const result = await createTestUser(orgId, {
      email: userEmail,
      password: 'TestPassword123!',
      role: 'agent',
    });
    plainPassword = result.plainPassword;
  });

  afterAll(async () => {
    await app?.close();
    await redis.quit();
  });

  beforeEach(async () => {
    const keys = await redis.keys('session:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  it('should login and set HTTP-only cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password: plainPassword });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('email', userEmail);
    expect(response.body).toHaveProperty('role', 'agent');
    expect(response.body).toHaveProperty('tenantId', orgId);
    expect(response.body).not.toHaveProperty('passwordHash');

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('HttpOnly');
  });

  it('should reject invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password: 'WrongPassword999!' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject nonexistent email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'TestPassword123!' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject missing fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject short password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password: 'short' });

    expect(response.status).toBe(400);
  });
});
