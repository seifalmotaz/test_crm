# Phase 2: Core Infrastructure — Auth, Errors, Guards, Config

## Goal
Build the foundational infrastructure that all feature modules depend on: configuration management, custom error system with RFC 7807 Problem Details, JWT authentication, tenant isolation guard, role/ownership guards, and base entity patterns.

## Why This Phase Second
Every feature module needs auth, error handling, and tenancy enforcement. These are cross-cutting concerns that must be solid before any business logic is written.

---

## File Manifest

### Configuration
- `src/config/app.config.ts` — Zod-validated environment configuration
- `src/config/database.config.ts` — Database-specific config
- `src/config/redis.config.ts` — Redis connection config
- `src/config/jwt.config.ts` — JWT key loading and settings

### Error System
- `src/common/errors/error-codes.ts` — Error code constants enum
- `src/common/errors/app-error.ts` — Base error class with code, status, i18nKey
- `src/common/errors/not-found.error.ts` — NotFoundError subclass
- `src/common/errors/validation.error.ts` — ValidationError subclass
- `src/common/errors/forbidden.error.ts` — ForbiddenError subclass
- `src/common/filters/problem-details.filter.ts` — NestJS exception filter

### Guards
- `src/common/guards/jwt-auth.guard.ts` — Validates access token from cookie
- `src/common/guards/roles.guard.ts` — Checks @Roles() metadata
- `src/common/guards/tenant.guard.ts` — Injects tenantId into request context
- `src/common/guards/ownership.guard.ts` — Validates resource ownership for agents
- `src/common/guards/super-admin.guard.ts` — Validates super admin flag

### Decorators
- `src/common/decorators/current-user.decorator.ts` — Extract user from request
- `src/common/decorators/roles.decorator.ts` — @Roles() metadata
- `src/common/decorators/public.decorator.ts` — @Public() skip auth
- `src/common/decorators/tenant.decorator.ts` — Extract tenantId from request

### DTOs
- `src/common/dto/pagination.dto.ts` — Standard pagination query
- `src/common/dto/sort.dto.ts` — Sort parameters

### Types
- `src/common/types/auth.types.ts` — AuthenticatedUser, RequestWithUser interfaces
- `src/common/types/pagination.types.ts` — PaginatedResult type

### Utilities
- `src/common/utils/uuid.ts` — UUIDv7 generation
- `src/common/utils/password.ts` — Argon2id hash and verify

### Tests
- `test/auth/login.spec.ts` — Login flow
- `test/auth/refresh.spec.ts` — Token refresh
- `test/auth/guards.spec.ts` — Guard behavior
- `test/errors/problem-details.spec.ts` — Error response format

---

## Task Breakdown

### 2.1 Error Code System

`src/common/errors/error-codes.ts`:
```typescript
export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Tenant
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  
  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_ROLE_INVALID: 'USER_ROLE_INVALID',
  
  // Organization
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  SLUG_EXISTS: 'SLUG_EXISTS',
  
  // Lead
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  LEAD_STAGE_INVALID: 'LEAD_STAGE_INVALID',
  LEAD_ALREADY_CONVERTED: 'LEAD_ALREADY_CONVERTED',
  
  // Deal
  DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
  DEAL_STAGE_INVALID: 'DEAL_STAGE_INVALID',
  DEAL_CLOSING_LOCKED: 'DEAL_CLOSING_LOCKED',
  
  // Property
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  PROPERTY_STATUS_CONFLICT: 'PROPERTY_STATUS_CONFLICT',
  
  // Commission
  COMMISSION_PLAN_NOT_FOUND: 'COMMISSION_PLAN_NOT_FOUND',
  COMMISSION_PLAN_MISSING: 'COMMISSION_PLAN_MISSING',
  COMMISSION_ALREADY_SETTLED: 'COMMISSION_ALREADY_SETTLED',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FORBIDDEN: 'FORBIDDEN',
} as const;
```

### 2.2 AppError Base Class

`src/common/errors/app-error.ts`:
```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly i18nKey?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### 2.3 Problem Details Filter

`src/common/filters/problem-details.filter.ts`:
```typescript
@Catch()
export class ProblemDetailsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    let problem: ProblemDetails;
    
    if (exception instanceof AppError) {
      problem = {
        type: 'about:blank',
        title: this.getTitleForStatus(exception.status),
        status: exception.status,
        code: exception.code,
        detail: exception.message,
        instance: request.url,
        i18nKey: exception.i18nKey,
      };
    } else {
      problem = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: ErrorCodes.INTERNAL_ERROR,
        detail: 'An unexpected error occurred',
        instance: request.url,
      };
    }
    
    response.status(problem.status).json(problem);
  }
}
```

### 2.4 JWT Authentication

Use `jose` library (modern, Bun-friendly, no native dependencies):

`src/common/guards/jwt-auth.guard.ts`:
```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private config: AppConfig,
    private redis: RedisService,
    private usersService: UsersService,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);
    
    if (!token) throw new UnauthorizedException();
    
    try {
      const { payload } = await jwtVerify(token, this.config.jwtPublicKey, {
        algorithms: ['RS256'],
        clockTolerance: 60,
      });
      
      const userId = payload.sub as string;
      // Check Redis cache first
      let user = await this.redis.get(`user:${userId}`);
      if (!user) {
        user = await this.usersService.findById(userId);
        await this.redis.setex(`user:${userId}`, 300, JSON.stringify(user));
      } else {
        user = JSON.parse(user);
      }
      
      request.user = user;
      return true;
    } catch (e) {
      if (e.code === 'ERR_JWT_EXPIRED') {
        throw new AppError(ErrorCodes.TOKEN_EXPIRED, 401, 'Token has expired');
      }
      throw new UnauthorizedException();
    }
  }
  
  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.access_token;
  }
}
```

### 2.5 Role Guard

`src/common/guards/roles.guard.ts`:
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!roles) return true; // No roles required
    
    const { user } = context.switchToHttp().getRequest();
    return roles.includes(user.role);
  }
}
```

### 2.6 Tenant Guard

`src/common/guards/tenant.guard.ts`:
```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user.tenantId) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, 403, 'No tenant associated with user');
    }
    
    // Check organization status
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, user.tenantId),
    });
    
    if (!org) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, 403, 'Organization not found');
    }
    
    if (org.status === 'suspended') {
      throw new AppError(ErrorCodes.TENANT_SUSPENDED, 403, 'Organization is suspended');
    }
    
    request.tenantId = user.tenantId;
    return true;
  }
}
```

### 2.7 Ownership Guard

`src/common/guards/ownership.guard.ts`:
```typescript
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const resourceType = this.reflector.get<string>('resourceType', context.getHandler());
    if (!resourceType) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Admin and Manager bypass ownership check
    if (user.role === 'admin' || user.role === 'manager') return true;
    
    // Agent can only access their own resources
    const resourceId = request.params.id;
    // Ownership check delegated to service layer or performed via DB query
    // This guard just marks the requirement; actual check in service
    request.ownershipRequired = true;
    request.resourceType = resourceType;
    
    return true;
  }
}
```

### 2.8 Super Admin Guard

`src/common/guards/super-admin.guard.ts`:
```typescript
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user.isSuperAdmin) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Super admin access required');
    }
    
    return true;
  }
}
```

### 2.9 Password Utilities

`src/common/utils/password.ts`:
```typescript
import * as argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

### 2.10 Pagination DTO

`src/common/dto/pagination.dto.ts`:
```typescript
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page: number = 1;
  
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit: number = 20;
  
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';
  
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
  
  @IsOptional()
  @IsString()
  search?: string;
}
```

### 2.11 Write Auth Integration Tests

```typescript
describe('Auth Flow', () => {
  it('should login and set HTTP-only cookie', async () => {
    // Create test user with hashed password
    // POST /api/auth/login
    // Assert Set-Cookie header with access_token
    // Assert response contains user object
  });
  
  it('should reject invalid credentials', async () => {
    // POST /api/auth/login with wrong password
    // Assert 401 with INVALID_CREDENTIALS code
  });
  
  it('should access protected endpoint with valid token', async () => {
    // Login, extract cookie
    // GET /api/auth/me with cookie
    // Assert 200 with user data
  });
  
  it('should reject expired token', async () => {
    // Wait for token expiry or manipulate clock
    // GET /api/auth/me
    // Assert 401 with TOKEN_EXPIRED code
  });
  
  it('should refresh token and issue new access token', async () => {
    // Login, wait for access token expiry
    // POST /api/auth/refresh
    // Assert new access_token cookie
  });
});
```

---

## Dependencies
- Phase 1 (DB, Redis, Drizzle setup)

## Verification

- [ ] `POST /api/auth/login` returns JWT in `Set-Cookie: access_token=...; HttpOnly`
- [ ] `GET /api/auth/me` with valid cookie returns user object with `tenantId`
- [ ] `GET /api/auth/me` without cookie returns 401 with `UNAUTHORIZED` code
- [ ] `POST /api/auth/refresh` with valid refresh token returns new access token
- [ ] Expired access token returns 401 with `TOKEN_EXPIRED` code
- [ ] Invalid credentials return 401 with `INVALID_CREDENTIALS` code
- [ ] `ProblemDetailsExceptionFilter` returns RFC 7807 format for all errors
- [ ] `TenantGuard` rejects requests for suspended organizations with `TENANT_SUSPENDED`
- [ ] `RolesGuard` rejects agent accessing admin endpoint with `FORBIDDEN`
- [ ] Argon2id hashes and verifies passwords correctly

## Risks

| Risk | Mitigation |
|------|-----------|
| `jose` library compatibility with Bun | Test JWT sign/verify immediately; fallback to `jsonwebtoken` if needed |
| Cookie parsing in NestJS | Ensure `cookie-parser` middleware or native parsing works |
| Redis connection pooling | Use `ioredis` with proper connection config |
