import { Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import { jwtConfig } from '@/config/jwt.config';
import { redis } from '@/db/redis';
import { db } from '@/db/connection';
import { superAdmins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/common/utils/password';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import type { AdminAuthenticatedUser } from '@/common/types/auth.types';

@Injectable()
export class AdminAuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;
  private cachedSecret: Uint8Array | null = null;

  private getSecret(): Uint8Array {
    if (this.cachedSecret) return this.cachedSecret;
    this.cachedSecret = new TextEncoder().encode(jwtConfig.secret);
    return this.cachedSecret;
  }

  async login(email: string, password: string) {
    const [admin] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.email, email))
      .limit(1);

    if (!admin) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    const accessToken = await this.signAccessToken(admin.id);

    const sessionData: AdminAuthenticatedUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isSuperAdmin: true,
    };
    await redis.setex(`session:admin:${admin.id}`, this.REFRESH_TOKEN_EXPIRY, JSON.stringify(sessionData));

    const refreshToken = await this.createRefreshToken(admin.id);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isSuperAdmin: true,
      },
      accessToken,
      refreshToken,
    };
  }

  async getMe(adminId: string) {
    const [admin] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.id, adminId))
      .limit(1);

    if (!admin) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Super admin not found');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isSuperAdmin: true,
    };
  }

  private async signAccessToken(adminId: string): Promise<string> {
    const secret = this.getSecret();
    return new SignJWT({
      sub: adminId,
      type: 'super_admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.ACCESS_TOKEN_EXPIRY)
      .setSubject(adminId)
      .sign(secret);
  }

  private async createRefreshToken(adminId: string): Promise<string> {
    const { uuidv7 } = await import('uuidv7');
    const refreshToken = uuidv7();
    await redis.setex(
      `refresh:admin:${adminId}`,
      this.REFRESH_TOKEN_EXPIRY,
      refreshToken,
    );
    return refreshToken;
  }
}
