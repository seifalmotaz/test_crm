import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '@/auth/auth.module';
import { createTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/db-cleanup';
import { createTestOrg, createTestUser, createAuthenticatedSession } from '../helpers/auth-helper';
import { db } from '@/db/connection';
import { redis } from '@/db/redis';

describe('Token Refresh', () => {
  let app: INestApplication;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = await createTestApp(module);
    await truncateAll(db);

    const org = await createTestOrg({ slug: `refresh-test-${Date.now()}` });
    orgId = org.id;

    const result = await createTestUser(orgId, {
      email: `refresh-user-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'agent',
    });
    userId = result.user.id;
  });

  afterAll(async () => {
    await app?.close();
    await redis.quit();
  });

  it('should refresh token and issue new access token', async () => {
    const { accessToken } = await createAuthenticatedSession(userId, orgId, 'agent', '0s');

    await new Promise(resolve => setTimeout(resolve, 1100));

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `access_token=${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(userId);

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='));
    expect(accessCookie).toBeDefined();
  });

  it('should reject refresh without token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('TOKEN_EXPIRED');
  });
});
