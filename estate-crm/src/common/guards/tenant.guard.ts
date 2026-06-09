import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { db } from '@/db/connection';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ErrorCodes } from '@/common/errors/error-codes';
import { AppError } from '@/common/errors/app-error';
import { PUBLIC_KEY } from '@/common/decorators/decorator-keys';
import type { AuthenticatedUser, AdminAuthenticatedUser } from '@/common/types/auth.types';

/**
 * Tenant isolation guard.
 * Validates that the user's organization exists and is not suspended.
 * Must run AFTER JwtAuthGuard (needs request.user).
 * Skips public routes.
 * Super admins bypass all tenant checks.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | AdminAuthenticatedUser | undefined;

    if (!user) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, 403, 'No user found in request');
    }

    if (user.isSuperAdmin) {
      return true;
    }

    const tenantUser = user as AuthenticatedUser;
    if (!tenantUser.tenantId) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, 403, 'No tenant associated with user');
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, tenantUser.tenantId))
      .limit(1);

    if (!org) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, 403, 'Organization not found');
    }

    if (org.status === 'suspended') {
      throw new AppError(ErrorCodes.TENANT_SUSPENDED, 403, 'Organization is suspended');
    }

    request.tenantId = tenantUser.tenantId;
    return true;
  }
}
