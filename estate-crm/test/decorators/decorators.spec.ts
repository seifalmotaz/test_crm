import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, RequestWithUser } from '@/common/types/auth.types';
import { ROLES_KEY, PUBLIC_KEY, TENANT_KEY } from '@/common/decorators/decorator-keys';

describe('Auth Types', () => {
  it('should define AuthenticatedUser interface with required fields', () => {
    const user: AuthenticatedUser = {
      id: 'abc',
      tenantId: 'xyz',
      role: 'admin',
      name: 'Test User',
      email: 'test@example.com',
      isSuperAdmin: false,
    };
    expect(user.id).toBe('abc');
    expect(user.tenantId).toBe('xyz');
    expect(user.role).toBe('admin');
  });

  it('should define RequestWithUser type extending Request', () => {
    const req: RequestWithUser = {
      user: {
        id: 'abc',
        tenantId: 'xyz',
        role: 'admin',
        name: 'Test User',
        email: 'test@example.com',
        isSuperAdmin: false,
      },
      tenantId: 'xyz',
    } as RequestWithUser;
    expect(req).toBeDefined();
    expect(req.user.id).toBe('abc');
  });
});

describe('Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('@CurrentUser()', () => {
    it('should be exported as a function', async () => {
      const { CurrentUser } = await import('@/common/decorators/current-user.decorator');
      expect(CurrentUser).toBeDefined();
      expect(typeof CurrentUser).toBe('function');
    });
  });

  describe('@Roles()', () => {
    it('should set roles metadata on a class', async () => {
      const { Roles } = await import('@/common/decorators/roles.decorator');

      @Roles('admin', 'manager')
      class TestController {}

      const roles = reflector.get<string[]>(ROLES_KEY, TestController);
      expect(roles).toEqual(['admin', 'manager']);
    });

    it('should set roles metadata on a method', async () => {
      const { Roles } = await import('@/common/decorators/roles.decorator');

      class TestController {
        @Roles('admin')
        find() {}
      }

      const roles = reflector.get<string[]>(ROLES_KEY, TestController.prototype.find);
      expect(roles).toEqual(['admin']);
    });

    it('should allow a single role argument', async () => {
      const { Roles } = await import('@/common/decorators/roles.decorator');

      class TestController {
        @Roles('admin')
        find() {}
      }

      const roles = reflector.get<string[]>(ROLES_KEY, TestController.prototype.find);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('@Public()', () => {
    it('should set public metadata to true on a class', async () => {
      const { Public } = await import('@/common/decorators/public.decorator');

      @Public()
      class TestController {}

      const isPublic = reflector.get<boolean>(PUBLIC_KEY, TestController);
      expect(isPublic).toBe(true);
    });

    it('should set public metadata to true on a method', async () => {
      const { Public } = await import('@/common/decorators/public.decorator');

      class TestController {
        @Public()
        login() {}
      }

      const isPublic = reflector.get<boolean>(PUBLIC_KEY, TestController.prototype.login);
      expect(isPublic).toBe(true);
    });
  });

  describe('@CurrentTenant()', () => {
    it('should be exported as a function (param decorator)', async () => {
      const { CurrentTenant } = await import('@/common/decorators/tenant.decorator');
      expect(CurrentTenant).toBeDefined();
      expect(typeof CurrentTenant).toBe('function');
    });
  });
});