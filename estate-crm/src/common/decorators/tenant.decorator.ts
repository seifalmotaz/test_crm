import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the tenant ID from the authenticated user.
 *
 * Usage:
 * ```ts
 * @Get()
 * findAll(@CurrentTenant() tenantId: string) {}
 * ```
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: { tenantId: string } }>();
    return request.user?.tenantId ?? '';
  },
);