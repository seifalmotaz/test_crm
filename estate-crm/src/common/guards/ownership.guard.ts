import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BYPASS_OWNERSHIP_KEY } from '@/common/decorators/decorator-keys';
import type { AuthenticatedUser } from '@/common/types/auth.types';

/**
 * Ownership guard for agent-level resource access control.
 * Admin and Manager roles bypass ownership checks.
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
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) return true;

    // Admin and Manager bypass ownership check
    if (user.role === 'admin' || user.role === 'manager') return true;

    // Agent: mark request for service-layer ownership validation
    request.ownershipRequired = true;

    return true;
  }
}
