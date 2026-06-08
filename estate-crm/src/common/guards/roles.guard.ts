import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PUBLIC_KEY } from '@/common/decorators/decorator-keys';
import { ErrorCodes } from '@/common/errors/error-codes';
import { AppError } from '@/common/errors/app-error';
import type { AuthenticatedUser } from '@/common/types/auth.types';

/**
 * Role-based access control guard.
 * Checks @Roles() metadata against the authenticated user's role.
 * Must run AFTER JwtAuthGuard (needs request.user).
 * Skips public routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Authentication required');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Insufficient permissions');
    }

    return true;
  }
}
