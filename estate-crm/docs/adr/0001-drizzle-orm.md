# Drizzle ORM over Prisma

We chose Drizzle ORM instead of Prisma or TypeORM for the new estate-crm backend. The existing crm-priv prototype uses Prisma, but Drizzle is lighter, more SQL-first, and better optimized for the Bun runtime. Drizzle's query builder gives us type-safe SQL without the heavy client generation and migration complexity that Prisma carries. The trade-off is less built-in relation handling — we write explicit joins. This is acceptable because our multi-tenant queries need careful control over `tenantId` filtering anyway.

**Considered options**: Prisma (familiar from prototype, heavier), TypeORM (verbose decorators, less type-safe), Drizzle (SQL-first, Bun-friendly, lighter).
