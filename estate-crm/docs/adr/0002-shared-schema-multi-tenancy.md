# Shared Schema Multi-Tenancy

We use a shared PostgreSQL database with a shared schema and a `tenantId` column on every entity table. Each Organization (real estate brokerage) is a tenant. All tenant data lives in the same tables, isolated by the `tenantId` foreign key. The NestJS `TenantGuard` enforces this at the application layer — services never accept `tenantId` from request parameters, only from the authenticated user's session.

This is simpler to maintain than separate schemas or databases per tenant. One migration applies to all tenants. The risk — a missing `tenantId` filter could leak data — is mitigated by mandatory guards and integration tests that verify cross-tenant isolation.

**Considered options**: Separate schema per tenant (better isolation, complex migrations), separate database per tenant (maximum isolation, overkill for v1), shared schema (simple, one migration, guard-enforced).
