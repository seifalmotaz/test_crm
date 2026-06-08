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
 * Express Request extended with authenticated user information.
 * Used in route handlers that require authentication.
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
  tenantId: string;
  ownershipRequired?: boolean;
  resourceType?: string;
}