import { SetMetadata } from '@nestjs/common';
import { PUBLIC_KEY } from './decorator-keys';

/**
 * Decorator that marks a route as publicly accessible (no authentication required).
 * JwtAuthGuard skips routes decorated with @Public().
 *
 * Usage:
 * ```ts
 * @Public()
 * @Post('login')
 * login() {}
 * ```
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);