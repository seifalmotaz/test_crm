# PropCRM

A production-grade real estate CRM for property teams. Manages the full pipeline from
lead capture through deal close, with commission tracking, agent performance analytics,
and automated task workflows.

## Features

- **Pipeline management** — Leads → Deals kanban with stage-gated business logic
- **Property listings** — Grid/list views, comparable sales, market analysis
- **Agent workspace** — Performance tiers, leaderboard, retention risk scoring
- **Client records** — Lifetime value, referral tracking, NPS
- **Task automation** — Tasks auto-generated when deals advance stages
- **Commission lifecycle** — 7-day hold → release → paid → adjusted/voided
- **Analytics** — Revenue trends, 30/90-day forecasts, channel ROI, agent cohort
- **Audit trail** — Every mutation logged; GDPR erasure endpoint

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 24 | CI pins Node 24 |
| npm | 11 | bundled with Node 24 |
| Docker + Compose | 24 / 2.20 | for the Docker path only |
| PostgreSQL | 15 | for the local path only |

---

## Local setup (without Docker)

```bash
# 1. Clone
git clone <repo-url> && cd propcrm

# 2. Root environment (optional — only VITE_* vars used locally)
cp .env.example .env

# 3. Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env:
#   DATABASE_URL=postgresql://USER:PASS@localhost:5432/propcrm
#   JWT_SECRET=<64-char hex>
#   JWT_REFRESH_SECRET=<different 64-char hex>
#   PORT=5001

# 4. Install dependencies
npm install
npm install --prefix backend

# 5. Create and apply the database schema
cd backend
npx prisma migrate dev --name init   # first time only — generates migrations/
npx prisma migrate deploy            # subsequent runs
node prisma/seed.js                  # loads demo agents, properties, leads, deals, clients, tasks
cd ..

# 6. Start both servers (two terminals)
npm run dev                # frontend → http://localhost:5173
cd backend && npm run dev  # backend  → http://localhost:5001
```

Generate secure JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run the command twice and put the two different outputs into `JWT_SECRET` and
`JWT_REFRESH_SECRET`.

> **Note on migrations:** `backend/prisma/migrations/` must exist and be committed
> before CI (`prisma migrate deploy`) can run. See [MIGRATIONS.md](MIGRATIONS.md)
> for the full workflow.

### Default login credentials (after seeding)

| Email | Password | Role |
|---|---|---|
| admin@propcrm.io | password123 | admin |
| sarah.j@propcrm.io | password123 | agent |
| marcus.c@propcrm.io | password123 | agent |

---

## Docker setup (full stack)

```bash
# 1. Configure secrets (only the root .env is needed)
cp .env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 2. Build and start all services (PostgreSQL + backend + frontend)
docker compose up --build

# 3. Seed demo data (first run only)
docker compose exec backend node prisma/seed.js
```

Services exposed:
- Frontend — http://localhost:5173
- Backend API — http://localhost:5001
- PostgreSQL — localhost:5432 (internal to Docker network only)

The backend container runs `prisma migrate deploy` automatically on startup before
launching the server.

---

## Architecture

```
Browser
  │
  ▼
┌─────────────────────────┐
│  Frontend (Vite + React) │  :5173 (dev) / :80 (Docker via nginx)
│  Tailwind CSS            │
│  React Router v7         │
└─────────────────────────┘
  │  /api/* and /uploads/* proxied in dev
  │  direct connection in production
  ▼
┌─────────────────────────┐
│  Backend (Express)       │  :5001
│  Prisma ORM              │
│  JWT auth                │
│  Multer file upload      │
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│  PostgreSQL 15           │  :5432
│  14 Prisma models        │
│  Soft deletes only       │
│  Optimistic concurrency  │
└─────────────────────────┘
```

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:5001` so
there are no CORS issues in development. In production the frontend is a static
build served by nginx; the backend is a separate container reachable through
the internal Docker network.

---

## Key scripts

### Frontend (project root)

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR on port 5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint on `src/` |

### Backend (`cd backend` first)

| Script | Description |
|---|---|
| `npm run dev` | nodemon — restarts on file changes |
| `npm test` | Jest + Supertest integration tests |
| `npm run lint` | ESLint on `src/` |
| `npm run db:migrate` | `prisma migrate dev --name init` |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Open Prisma Studio at :5555 |
| `npm run db:reset` | Drop, re-migrate, and reseed (dev only) |

---

## API route groups

All routes are prefixed with `/api`. No Swagger UI is currently deployed.

| Prefix | Description |
|---|---|
| `/api/auth` | `register`, `login`, `logout`, `refresh-token`, `GET /me` |
| `/api/dashboard` | Summary KPIs, revenue series, pipeline, top agents, closing-soon |
| `/api/properties` | Full CRUD, soft delete, pagination, comps, market analysis, photo upload |
| `/api/leads` | Full CRUD, funnel stats, lead scoring, merge duplicates, convert to deal |
| `/api/deals` | Full CRUD, stage FSM, commission record, document upload |
| `/api/agents` | Read + update, performance metrics, leaderboard, retention risk |
| `/api/clients` | Full CRUD, lifetime value breakdown, referral tracking |
| `/api/tasks` | Full CRUD, subtasks, overdue tracking, auto-generation on deal events |
| `/api/analytics` | Revenue by period/segment, 30/90-day forecast, channel ROI, agent cohort |
| `/api/files` | Multipart file upload and metadata retrieval |
| `/api/notifications` | In-app inbox, mark-read, mark-all-read |
| `/api/admin` | Audit log, GDPR erasure, commission admin, DB maintenance |

All success responses: `{ success: true, data, meta: { timestamp, version } }`
All error responses: `{ success: false, error: { code, message, details? } }`

---

## CI

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and
pull request to `main`. Four independent jobs must all pass before merge:

| Job | What it does |
|---|---|
| **test** | Spins up Postgres 15, runs `prisma migrate deploy`, then `npm test` |
| **lint** | Runs `eslint src/` on the frontend |
| **build** | Runs `vite build` to confirm the frontend compiles cleanly |
| **docker-build** | Builds both Docker images to confirm neither Dockerfile is broken |

Three repository secrets must be configured before CI passes:
`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.

---

## Contributing

### Branch naming

```
feature/<short-description>   # new functionality
fix/<short-description>       # bug fixes
chore/<short-description>     # tooling, deps, or refactors with no user-facing change
```

### Pull request process

1. Branch from `main`. Keep PRs focused on a single concern.
2. If you change `schema.prisma`, generate and commit the migration in the same PR:
   ```bash
   cd backend
   npx prisma migrate dev --name <description>
   ```
3. Run tests locally before pushing — CI will block on failures:
   ```bash
   cd backend && npm test
   ```
4. Run both linters:
   ```bash
   npm run lint                 # frontend
   cd backend && npm run lint   # backend
   ```
5. Open the PR against `main`. All four CI jobs must be green before merge.
6. At least one review approval is required.

### Running tests locally

```bash
cd backend
# Requires a running PostgreSQL instance and DATABASE_URL set in backend/.env
# Use a separate database from your development database
npm test
```

Tests use Jest + Supertest against a real database — no mocks. The test runner
sets `NODE_ENV=test`; point `DATABASE_URL` at a dedicated test database to avoid
polluting development data.
