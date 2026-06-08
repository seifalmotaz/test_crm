import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/auth.types';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 *
 * Usage:
 * ```ts
 * @Get('me')
 * find(@CurrentUser() user: AuthenticatedUser) {}
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);