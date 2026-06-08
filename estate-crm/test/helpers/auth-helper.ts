import { uuidv7 } from 'uuidv7';
import * as argon2 from 'argon2';
import { db } from '@/db/connection';
import { users, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SignJWT, importPKCS8, importSPKI } from 'jose';
import { redis } from '@/db/redis';

/** Test organization fields for quick setup */
export interface TestOrgFields {
  name?: string;
  slug?: string;
  status?: string;
}

/** Test user fields for quick setup */
export interface TestUserFields {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  status?: string;
}

/** Result of creating a test org + user pair */
export interface TestUserAndOrg {
  org: typeof organizations.$inferSelect;
  user: typeof users.$inferSelect;
  plainPassword: string;
}

/**
 * Creates a test organization with default values.
 */
export async function createTestOrg(fields: TestOrgFields = {}) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: fields.name ?? 'Test Agency',
      slug: fields.slug ?? `test-agency-${Date.now()}`,
      status: fields.status ?? 'active',
    })
    .returning();
  return org;
}

/**
 * Creates a test user within an organization with default values.
 * Handles password hashing automatically.
 * Returns the user and the plain password for login tests.
 */
export async function createTestUser(
  orgId: string,
  fields: TestUserFields = {},
): Promise<TestUserAndOrg> {
  const plainPassword = fields.password ?? 'Password123!';
  const passwordHash = await argon2.hash(plainPassword);

  const [user] = await db
    .insert(users)
    .values({
      tenantId: orgId,
      email: fields.email ?? `test-user-${Date.now()}@example.com`,
      passwordHash,
      name: fields.name ?? 'Test User',
      role: fields.role ?? 'agent',
      status: fields.status ?? 'active',
    })
    .returning();

  const org = await findOrg(orgId);
  return { user, plainPassword, org };
}

async function findOrg(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return org!;
}

export { findOrg };

/**
 * Creates a full test scenario: org + user.
 * Returns the org, user, and plain password for auth tests.
 */
export async function createTestOrgWithUser(
  orgFields: TestOrgFields = {},
  userFields: TestUserFields = {},
): Promise<TestUserAndOrg> {
  const org = await createTestOrg(orgFields);
  const result = await createTestUser(org.id, userFields);
  return { ...result, org };
}

// Cache the loaded keys for reuse
let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicKey: CryptoKey | null = null;

/**
 * Imports the JWT private key for signing.
 */
async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;

  const pem = process.env.JWT_PRIVATE_KEY!;
  // Handle literal \n in .env (Bun doesn't escape them)
  const withNewlines = pem.replace(/\\n/g, '\n');
  const cleaned = withNewlines
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  cachedPrivateKey = await importPKCS8(
    `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`,
    'RS256',
  );
  return cachedPrivateKey;
}

/**
 * Imports the JWT public key for verification.
 */
export async function getPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;

  const pem = process.env.JWT_PUBLIC_KEY!;
  const withNewlines = pem.replace(/\\n/g, '\n');
  const cleaned = withNewlines
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  cachedPublicKey = await importSPKI(
    `-----BEGIN PUBLIC KEY-----\n${cleaned}\n-----END PUBLIC KEY-----`,
    'RS256',
  );
  return cachedPublicKey;
}

/**
 * Creates a signed JWT access token for the given user.
 * Returns the token string. Does NOT store it in Redis.
 */
export async function createAccessToken(
  userId: string,
  tenantId: string,
  role: string,
  expiresIn = '15m',
): Promise<string> {
  const privateKey = await getPrivateKey();

  return new SignJWT({ sub: userId, tenantId, role })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(userId)
    .sign(privateKey);
}

/**
 * Creates a signed JWT access token AND stores user session in Redis.
 * This simulates the full login flow.
 */
export async function createAuthenticatedSession(
  userId: string,
  tenantId: string,
  role: string,
  expiresIn = '15m',
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await createAccessToken(userId, tenantId, role, expiresIn);

  // Store user session in Redis (same pattern as auth service)
  const redisKey = `session:${tenantId}:${userId}`;
  const sessionData = JSON.stringify({ id: userId, tenantId, role });
  await redis.setex(redisKey, 900, sessionData); // 15 min TTL

  // Create refresh token
  const refreshToken = uuidv7();
  const refreshKey = `refresh:${tenantId}:${userId}`;
  await redis.setex(refreshKey, 7 * 24 * 60 * 60, refreshToken); // 7 days

  return { accessToken, refreshToken };
}

/**
 * Extracts the access token from a Set-Cookie header (for testing cookie-based auth).
 */
export function extractAccessToken(
  setCookieHeader: string | string[] | undefined,
): string | null {
  if (!setCookieHeader) return null;

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];

  for (const cookie of cookies) {
    const match = cookie.match(/access_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extracts the refresh token from a Set-Cookie header.
 */
export function extractRefreshToken(
  setCookieHeader: string | string[] | undefined,
): string | null {
  if (!setCookieHeader) return null;

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];

  for (const cookie of cookies) {
    const match = cookie.match(/refresh_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Cleans up Redis keys created during auth tests.
 */
export async function cleanupAuthSession(
  tenantId: string,
  userId: string,
): Promise<void> {
  await redis.del(`session:${tenantId}:${userId}`);
  await redis.del(`refresh:${tenantId}:${userId}`);
}