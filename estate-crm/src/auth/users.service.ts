import { Injectable } from '@nestjs/common';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '@/common/errors/not-found.error';
import { ErrorCodes } from '@/common/errors/error-codes';

/**
 * Minimal UsersService used by JwtAuthGuard to look up users.
 * Full user management is in the Users module (Phase 4).
 */
@Injectable()
export class UsersService {
  async findById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundError('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    return user;
  }

  async findByEmailAndTenant(email: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    return user ?? null;
  }
}
