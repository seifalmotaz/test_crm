# Phase 1: Project Bootstrap & Infrastructure

## Goal
Create the `estate-crm/` directory, initialize a NestJS project with Bun runtime, configure Drizzle ORM for PostgreSQL, set up Docker Compose for PostgreSQL + Redis, and establish the core project structure that all subsequent phases depend on.

## Why This Phase First
Without the project skeleton, database connection, and build tooling, no other phase can begin. This phase establishes the contract between application code and infrastructure.

---

## File Manifest

### Configuration Files
- `package.json` — Bun + NestJS dependencies, scripts
- `bunfig.toml` — Bun runtime configuration
- `tsconfig.json` — Strict TypeScript with path aliases
- `.env.example` — Environment variable template
- `docker-compose.yml` — PostgreSQL 16 + Redis 7
- `drizzle.config.ts` — Drizzle Kit configuration
- `vitest.config.ts` — Test runner configuration

### Source Files
- `src/main.ts` — NestJS application bootstrap
- `src/app.module.ts` — Root module importing all feature modules
- `src/db/schema.ts` — Complete database schema (all tables)
- `src/db/connection.ts` — Drizzle client with connection pooling
- `src/db/migrate.ts` — Migration runner script
- `src/db/seed.ts` — Database seed script
- `src/config/app.config.ts` — Environment validation with Zod

### Test Files
- `test/setup.ts` — Test database setup and teardown
- `test/database-connection.spec.ts` — Verify DB/Redis connectivity

---

## Task Breakdown

### 1.1 Initialize Project
```bash
mkdir estate-crm
cd estate-crm
bun init -y
```

Set `name` to `estate-crm`, add scripts.

### 1.2 Install Dependencies

**Production:**
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` — NestJS framework
- `@nestjs/swagger` — OpenAPI documentation
- `drizzle-orm` — Type-safe SQL query builder
- `postgres` — PostgreSQL driver (Drizzle companion)
- `zod` — Runtime schema validation
- `argon2` — Password hashing (Argon2id)
- `jose` — JWT signing/verification (modern, Bun-friendly)
- `ioredis` — Redis client
- `uuidv7` — UUID v7 generation

**Development:**
- `@nestjs/testing` — NestJS test utilities
- `vitest` — Test runner (Bun-compatible)
- `drizzle-kit` — Schema management and migrations
- `@types/node` — Node.js type definitions
- `typescript` — TypeScript compiler

### 1.3 Configure TypeScript

Strict settings enabled:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `paths: { "@/*": ["./src/*"] }`

### 1.4 Configure Docker Compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: estate_crm
      POSTGRES_USER: estate_crm
      POSTGRES_PASSWORD: estate_crm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Test databases
  postgres_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: estate_crm_test
      POSTGRES_USER: estate_crm
      POSTGRES_PASSWORD: estate_crm
    ports:
      - "5433:5432"
```

### 1.5 Configure Drizzle

`drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 1.6 Define Complete Database Schema

All tables in `src/db/schema.ts`:

**Base fields (every table):**
- `id`: `uuid("id").primaryKey().$defaultFn(() => uuidv7())`
- `tenantId`: `uuid("tenant_id").notNull()`
- `createdAt`: `timestamp("created_at", { withTimezone: true }).defaultNow().notNull()`
- `updatedAt`: `timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()`
- `deletedAt`: `timestamp("deleted_at", { withTimezone: true })` — soft delete

**Tables:**
1. `organizations` — Tenant base table (no `tenantId`, no soft delete)
2. `users` — Tenant users with role, status, commissionSplit
3. `projects` — Development projects
4. `properties` — Real estate properties with JSONB attributes
5. `leads` — Lead pipeline
6. `leadInteractions` — Append-only interactions
7. `clients` — Direct clients
8. `deals` — Deal pipeline
9. `commissionPlans` — Commission configuration
10. `commissionRecords` — Immutable financial records
11. `tasks` — Entity-linked tasks
12. `notifications` — In-app notifications
13. `auditLogs` — Immutable user action logs

### 1.7 Create Database Connection

`src/db/connection.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
```

### 1.8 Create Configuration Loader

`src/config/app.config.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_PRIVATE_KEY: z.string(), // PEM format RS256 private key
  JWT_PUBLIC_KEY: z.string(),   // PEM format RS256 public key
  COOKIE_DOMAIN: z.string().default('localhost'),
  S3_BUCKET: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
});

export type AppConfig = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);
```

### 1.9 Bootstrap NestJS Application

`src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  // Swagger setup deferred to Phase 11
  await app.listen(config.PORT);
}
bootstrap();
```

`src/app.module.ts`:
```typescript
@Module({
  imports: [
    // Feature modules imported in subsequent phases
  ],
})
export class AppModule {}
```

### 1.10 Add Package Scripts

```json
{
  "dev": "bun --watch src/main.ts",
  "build": "bun build src/main.ts --outdir dist --target node",
  "start:prod": "bun dist/main.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "bun src/db/migrate.ts",
  "db:seed": "bun src/db/seed.ts",
  "db:studio": "drizzle-kit studio",
  "db:reset": "bun src/db/migrate.ts --reset && bun src/db/seed.ts"
}
```

### 1.11 Write Connection Test

`test/database-connection.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

describe('Database', () => {
  it('should connect to PostgreSQL', async () => {
    const result = await db.execute(sql`SELECT 1 as test`);
    expect(result[0].test).toBe(1);
  });
});
```

---

## Dependencies
- None (starting fresh)

## Verification

- [ ] `bun install` completes without errors
- [ ] `docker-compose up -d` starts PostgreSQL and Redis
- [ ] `bun run db:generate` creates migration files
- [ ] `bun run db:migrate` applies all migrations successfully
- [ ] `bun run db:seed` inserts test data without errors
- [ ] `bun run dev` starts NestJS server on port 3000
- [ ] `bun test` passes database connection test
- [ ] `bun run build` compiles without TypeScript errors

## Risks

| Risk | Mitigation |
|------|-----------|
| Drizzle + Bun compatibility issues | Test migration and seed scripts immediately; fallback to Prisma if critical |
| Missing PostgreSQL `uuidv7` extension | Use `uuidv7` npm package instead of `gen_random_uuid()` |
| Path aliases not resolving | Verify `tsconfig.json` paths and Bun module resolution |
