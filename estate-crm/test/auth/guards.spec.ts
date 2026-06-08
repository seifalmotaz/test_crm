import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, Module } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/db-cleanup';
import { createTestOrg, createTestUser, createAuthenticatedSession } from '../helpers/auth-helper';
import { db } from '@/db/connection';
import { redis } from '@/db/redis';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@Controller('test')
class TestController {
  @Get('public')
  @Public()
  publicEndpoint() {
    return { ok: true };
  }

  @Get('protected')
  protectedEndpoint(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.id, role: user.role };
  }

  @Get('admin-only')
  @Roles('admin')
  adminEndpoint(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.id, role: user.role };
  }

  @Get('admin-or-manager')
  @Roles('admin', 'manager')
  adminOrManagerEndpoint() {
    return { ok: true };
  }
}

@Module({
  controllers: [TestController],
})
class TestModule {}

describe('Guard Behavior', () => {
  let app: INestApplication;
  let orgId: string;
  let agentId: string;
  let adminId: string;
  let managerId: string;

  beforeAll(async () => {
    await truncateAll(db);

    const org = await createTestOrg({ slug: `guard-behavior-${Date.now()}` });
    orgId = org.id;

    const agent = await createTestUser(orgId, {
      email: `agent-${Date.now()}@example.com`,
      role: 'agent',
    });
    agentId = agent.user.id;

    const admin = await createTestUser(orgId, {
      email: `admin-${Date.now()}@example.com`,
      role: 'admin',
    });
    adminId = admin.user.id;

    const manager = await createTestUser(orgId, {
      email: `manager-${Date.now()}@example.com`,
      role: 'manager',
    });
    managerId = manager.user.id;

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = await createTestApp(module);
  });

  afterAll(async () => {
    await app?.close();
    await redis.quit();
  });

  describe('@Public()', () => {
    it('should allow unauthenticated access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/test/public');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('JwtAuthGuard', () => {
    it('should allow access with valid token', async () => {
      const { accessToken } = await createAuthenticatedSession(agentId, orgId, 'agent');

      const response = await request(app.getHttpServer())
        .get('/api/test/protected')
        .set('Cookie', `access_token=${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(agentId);
    });

    it('should reject request without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/test/protected');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('RolesGuard', () => {
    it('should allow admin to access admin-only endpoint', async () => {
      const { accessToken } = await createAuthenticatedSession(adminId, orgId, 'admin');

      const response = await request(app.getHttpServer())
        .get('/api/test/admin-only')
        .set('Cookie', `access_token=${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
    });

    it('should reject agent accessing admin endpoint with FORBIDDEN', async () => {
      const { accessToken } = await createAuthenticatedSession(agentId, orgId, 'agent');

      const response = await request(app.getHttpServer())
        .get('/api/test/admin-only')
        .set('Cookie', `access_token=${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow both admin and manager to shared endpoint', async () => {
      const adminSession = await createAuthenticatedSession(adminId, orgId, 'admin');
      const managerSession = await createAuthenticatedSession(managerId, orgId, 'manager');

      const adminResponse = await request(app.getHttpServer())
        .get('/api/test/admin-or-manager')
        .set('Cookie', `access_token=${adminSession.accessToken}`);

      expect(adminResponse.status).toBe(200);

      const managerResponse = await request(app.getHttpServer())
        .get('/api/test/admin-or-manager')
        .set('Cookie', `access_token=${managerSession.accessToken}`);

      expect(managerResponse.status).toBe(200);
    });

    it('should reject agent accessing admin-or-manager endpoint', async () => {
      const { accessToken } = await createAuthenticatedSession(agentId, orgId, 'agent');

      const response = await request(app.getHttpServer())
        .get('/api/test/admin-or-manager')
        .set('Cookie', `access_token=${accessToken}`);

      expect(response.status).toBe(403);
    });
  });
});
