import type { Request } from 'express';

/**
 * Authenticated user information extracted from the JWT token.
 * Attached to the request object by JwtAuthGuard.
 */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

/**
 * Authenticated super admin information extracted from the JWT token.
 * Platform-level user with no tenant association.
 */
export interface AdminAuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: true;
}

/**
 * Express Request extended with authenticated user information.
 * Used in route handlers that require authentication.
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser | AdminAuthenticatedUser;
  tenantId: string;
  ownershipRequired?: boolean;
  resourceType?: string;
}