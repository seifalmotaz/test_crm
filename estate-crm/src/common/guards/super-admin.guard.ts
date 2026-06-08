import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { ErrorCodes } from '@/common/errors/error-codes';
import { AppError } from '@/common/errors/app-error';
import type { AuthenticatedUser } from '@/common/types/auth.types';

/**
 * Super Admin access guard.
 * Validates that the authenticated user has super admin privileges.
 * Must run AFTER JwtAuthGuard (needs request.user).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user?.isSuperAdmin) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Super admin access required');
    }

    return true;
  }
}
