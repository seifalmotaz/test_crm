import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './decorator-keys';

/**
 * Decorator that specifies which roles are allowed to access a route.
 * Works with RolesGuard to enforce role-based access control.
 *
 * Usage:
 * ```ts
 * @Roles('admin')
 * @Roles('admin', 'manager')
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);