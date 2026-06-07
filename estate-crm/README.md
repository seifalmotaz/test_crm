# Estate-CRM

Multi-tenant CRM system for real estate brokerage organizations.

## What is this?

Estate-CRM is a backend-only CRM platform designed for real estate brokers. A single SaaS instance hosts multiple real estate brokerage companies (tenants), each managing their own agents, properties, leads, deals, and commissions.

## Tech Stack

- **Runtime**: Bun
- **Framework**: NestJS
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL 16+
- **ORM**: Drizzle ORM
- **Cache**: Redis
- **Queue**: BullMQ (reserved for future use)
- **Auth**: JWT (HTTP-only cookies), Argon2id
- **API Docs**: OpenAPI/Swagger with full request/response schemas
- **Testing**: Vitest with integration tests against real test database
- **Error Handling**: RFC 7807 Problem Details with application error codes

## Folder Structure

```
estate-crm/
├── docs/
│   └── adr/              # Architecture Decision Records
├── plan/                 # This directory — project execution plans
│   ├── README.md         # Ideation summary
│   ├── CONTEXT.md        # Domain language and glossary
│   ├── specs/            # Module specifications
│   ├── stories/          # User stories
│   └── phases/           # Phase-by-phase execution plans
├── src/
│   ├── modules/          # NestJS feature modules
│   ├── common/           # Shared guards, decorators, filters
│   ├── db/               # Drizzle schema and connection
│   └── config/           # Application configuration
└── tests/                # Integration and unit tests
```

## Domain Overview

An **Organization** (tenant) is a real estate brokerage company. Each Organization has **Users** with roles: **Admin** (broker owner), **Manager** (team lead), or **Agent** (standard). Agents work **Leads** through a pipeline, manage **Clients**, and close **Deals** on **Properties** that may belong to **Projects** (developments).

A **Super Admin** (SaaS operator) manages Organizations, plans, and system-wide settings.

## Architecture Principles

1. **Multi-tenancy via shared schema** — Every entity table has a `tenantId` column. The auth system enforces tenant isolation at the service layer.
2. **Services are UI-agnostic** — Services return domain errors, never HTTP-specific objects. Controllers handle the HTTP mapping.
3. **Error codes as contract** — Every error has a machine-readable code (e.g., `LEAD_STAGE_INVALID`). The frontend uses codes, not messages, for error handling.
4. **Full traceability** — All financial operations (commissions) are recorded with audit trails. Departed agents' KPIs are preserved historically.
5. **JSONB for polymorphic data** — Property attributes vary by type (apartment, villa, etc.) and are stored in JSONB with strict Zod validation.
6. **Soft deletes for tenant data** — All tenant-facing entities use soft deletes. Hard deletes are reserved for super admin tenant removal.
7. **Synchronous first** — Background jobs deferred to v2. Commission records are immutable logs in v1 (no settlement workflow). Task creation is manual in v1 (no automation). Chat is polling-based in v1 (no WebSockets).

## Development

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Install dependencies
bun install

# Run migrations
bun run db:migrate

# Seed test data
bun run db:seed

# Start development server
bun run dev

# Run tests
bun test

# Open API docs
open http://localhost:3000/api/docs
```

## Core Modules

| Module | Purpose |
|--------|---------|
| Auth | JWT authentication, password hashing, refresh tokens |
| Organizations | Tenant CRUD, super admin management |
| Users | Role management, agent deactivation/departure |
| Projects | Real estate development projects |
| Properties | Property listings with polymorphic attributes |
| Leads | Lead pipeline (fresh → qualified → followUp → reservation) - **manual scoring** |
| Clients | Direct clients, VIP management, lead conversion |
| Deals | Deal pipeline and property transactions - **manual probability** |
| CommissionPlans | Tenant-level commission configuration |
| CommissionRecords | Commission lifecycle - **auto-calculated, immutable logs in v1** |
| Tasks | Entity-linked tasks and assignments - **manual only in v1** |
| Notifications | In-app notifications |
| AuditLog | User-level audit trail |
| Dashboard | Role-based KPI aggregation |
| Chat | In-app messaging (direct + group) - **polling in v1** |
| SuperAdmin | Cross-tenant administration |

## Error Code Taxonomy

See `src/common/errors/error-codes.ts` for the full list. Key families:

- `VALIDATION_*` — Input validation failures
- `AUTH_*` — Authentication and authorization
- `TENANT_*` — Organization-level issues
- `USER_*` — User management
- `LEAD_*` — Lead pipeline
- `DEAL_*` — Deal pipeline
- `PROPERTY_*` — Property and project
- `COMMISSION_*` — Commission calculation and settlement
- `INTERNAL_*` — System-level errors

## OpenAPI Contract

Every controller endpoint documents:
- Request body schema (Zod-validated DTOs)
- Success response schema
- All possible error responses with Problem Details examples
- Required roles and tenant scoping rules

The frontend generates its TypeScript client SDK from the OpenAPI spec.

## License

Internal project.
