import { Injectable } from '@nestjs/common';
import { SignJWT, importPKCS8 } from 'jose';
import { config } from '@/config/app.config';
import { redis } from '@/db/redis';
import { db } from '@/db/connection';
import { users, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPassword } from '@/common/utils/password';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@Injectable()
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
  private cachedPrivateKey: CryptoKey | null = null;

  private async getPrivateKey(): Promise<CryptoKey> {
    if (this.cachedPrivateKey) return this.cachedPrivateKey;
    // Handle both actual newlines and escaped \n in .env
    const pem = config.JWT_PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const formatted = `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
    this.cachedPrivateKey = await importPKCS8(formatted, 'RS256');
    return this.cachedPrivateKey;
  }

  /**
   * Authenticate user with email and password.
   * Returns the authenticated user and sets tokens in Redis.
   */
  async login(email: string, password: string, tenantId?: string) {
    // Find user by email
    const conditions = [eq(users.email, email)];
    if (tenantId) {
      conditions.push(eq(users.tenantId, tenantId));
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(1);

    if (!user) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    // Sign access token
    const accessToken = await this.signAccessToken(user);

    // Store session in Redis
    const sessionData: AuthenticatedUser = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
      isSuperAdmin: false,
    };
    await redis.setex(
      `session:${user.tenantId}:${user.id}`,
      900,
      JSON.stringify(sessionData),
    );

    // Create refresh token
    const refreshToken = await this.createRefreshToken(user.tenantId, user.id);

    // Look up org name
    const orgName = await this.getOrgName(user.tenantId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: orgName,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using the expired access token cookie.
   * Decodes the expired JWT to get userId, checks Redis for refresh token.
   */
  async refresh(expiredAccessToken: string) {
    // Decode expired token (no verification — it's expired)
    const { decodeJwt } = await import('jose');
    const decoded = decodeJwt(expiredAccessToken);

    if (!decoded?.sub || !decoded?.tenantId) {
      throw new AppError(ErrorCodes.TOKEN_EXPIRED, 401, 'Invalid token payload');
    }

    const userId = decoded.sub as string;
    const tenantId = decoded.tenantId as string;

    // Check Redis for refresh token
    const refreshToken = await redis.get(`refresh:${tenantId}:${userId}`);
    if (!refreshToken) {
      throw new AppError(ErrorCodes.TOKEN_EXPIRED, 401, 'Refresh token expired or not found');
    }

    // Fetch user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'User not found or inactive');
    }

    // Issue new access token
    const newAccessToken = await this.signAccessToken(user);

    // Rotate refresh token
    const newRefreshToken = await this.createRefreshToken(tenantId, userId);

    // Update session cache
    const sessionData: AuthenticatedUser = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
      isSuperAdmin: false,
    };
    await redis.setex(
      `session:${tenantId}:${userId}`,
      900,
      JSON.stringify(sessionData),
    );

    const orgName = await this.getOrgName(user.tenantId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: orgName,
        status: user.status,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout: clear session and refresh token from Redis.
   */
  async logout(tenantId: string, userId: string) {
    await redis.del(`session:${tenantId}:${userId}`);
    await redis.del(`refresh:${tenantId}:${userId}`);
  }

  /**
   * Get current user from session.
   */
  async getMe(userId: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
    }

    const orgName = await this.getOrgName(user.tenantId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: orgName,
      status: user.status,
    };
  }

  private async signAccessToken(user: {
    id: string;
    tenantId: string;
    role: string;
  }): Promise<string> {
    const privateKey = await this.getPrivateKey();
    return new SignJWT({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime(this.ACCESS_TOKEN_EXPIRY)
      .setSubject(user.id)
      .sign(privateKey);
  }

  private async createRefreshToken(
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const { uuidv7 } = await import('uuidv7');
    const refreshToken = uuidv7();
    await redis.setex(
      `refresh:${tenantId}:${userId}`,
      this.REFRESH_TOKEN_EXPIRY,
      refreshToken,
    );
    return refreshToken;
  }

  private async getOrgName(tenantId: string): Promise<string> {
    const { organizations } = await import('@/db/schema');
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);
    return org?.name ?? '';
  }
}
