import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { jwtVerify, decodeJwt } from 'jose';
import { jwtConfig } from '@/config/jwt.config';
import { redis } from '@/db/redis';
import { db } from '@/db/connection';
import { users, superAdmins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ErrorCodes } from '@/common/errors/error-codes';
import { AppError } from '@/common/errors/app-error';
import { PUBLIC_KEY } from '@/common/decorators/decorator-keys';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, AdminAuthenticatedUser } from '@/common/types/auth.types';

function getSecret() {
  return new TextEncoder().encode(jwtConfig.secret);
}

/**
 * Global JWT authentication guard.
 * Extracts access_token from HTTP-only cookie, verifies JWT,
 * and attaches the authenticated user to the request.
 *
 * Supports both regular users and super admins.
 * Skips routes decorated with @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'No access token provided');
    }

    try {
      const secretKey = getSecret();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ['HS256'],
        clockTolerance: 0,
      });

      const userId = payload.sub as string;
      const isSuperAdminToken = payload.type === 'super_admin';

      if (isSuperAdminToken) {
        // Super admin path — no tenant
        let admin: AdminAuthenticatedUser;
        const cached = await redis.get(`session:admin:${userId}`);

        if (cached) {
          admin = JSON.parse(cached);
        } else {
          const [dbAdmin] = await db
            .select()
            .from(superAdmins)
            .where(eq(superAdmins.id, userId))
            .limit(1);

          if (!dbAdmin) {
            throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Super admin not found');
          }

          admin = {
            id: dbAdmin.id,
            email: dbAdmin.email,
            name: dbAdmin.name,
            isSuperAdmin: true,
          };

          await redis.setex(`session:admin:${userId}`, 900, JSON.stringify(admin));
        }

        request.user = admin;
        return true;
      }

      // Regular user path
      const tenantId = payload.tenantId as string;

      // Check Redis cache first
      let sessionData = await redis.get(`session:${tenantId}:${userId}`);
      let user: AuthenticatedUser;

      if (sessionData) {
        user = JSON.parse(sessionData);
      } else {
        // Fetch from DB
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!dbUser || dbUser.status !== 'active') {
          throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'User not found or inactive');
        }

        user = {
          id: dbUser.id,
          tenantId: dbUser.tenantId,
          role: dbUser.role,
          name: dbUser.name,
          email: dbUser.email,
          isSuperAdmin: false,
        };

        // Cache in Redis for 15 minutes
        await redis.setex(`session:${tenantId}:${userId}`, 900, JSON.stringify(user));
      }

      request.user = user;
      request.tenantId = user.tenantId;
      return true;
    } catch (e: unknown) {
      if (e instanceof AppError) throw e;

      // Try to decode expired token for refresh flow
      try {
        const decoded = decodeJwt(token);
        if (decoded?.sub) {
          throw new AppError(ErrorCodes.TOKEN_EXPIRED, 401, 'Access token has expired');
        }
      } catch (decodeErr: unknown) {
        if (decodeErr instanceof AppError) throw decodeErr;
      }

      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Invalid access token');
    }
  }

  private extractTokenFromCookie(request: Record<string, unknown>): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.access_token;
  }
}
