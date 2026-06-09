import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BYPASS_OWNERSHIP_KEY } from '@/common/decorators/decorator-keys';
import type { AuthenticatedUser, AdminAuthenticatedUser } from '@/common/types/auth.types';

/**
 * Ownership guard for agent-level resource access control.
 * Admin, Manager, and Super Admin roles bypass ownership checks.
 * Agent role is marked for service-layer ownership validation.
 *
 * This guard is a "soft" guard — it sets request.ownershipRequired = true
 * for agents, but the actual DB-level ownership check is done in the service layer.
 * This keeps the guard fast and the logic testable per-entity.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const bypassOwnership = this.reflector.getAllAndOverride<boolean>(BYPASS_OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (bypassOwnership) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | AdminAuthenticatedUser | undefined;

    if (!user) return true;

    if (user.isSuperAdmin) return true;

    const tenantUser = user as AuthenticatedUser;
    // Admin and Manager bypass ownership check
    if (tenantUser.role === 'admin' || tenantUser.role === 'manager') return true;

    // Agent: mark request for service-layer ownership validation
    request.ownershipRequired = true;

    return true;
  }
}
