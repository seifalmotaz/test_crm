# PropCRM — Project Status & Manual Run Guide

---

## How to Run the Project Manually

### Prerequisites
- **Node.js** v18 or higher
- **PostgreSQL** v14 or higher (running locally on port 5432)
- A PostgreSQL database named `propcrm` with a user that has full access to it

---

### Step 1 — Configure the Backend Environment

```
cd backend
copy .env.example .env
```

Open `backend/.env` and fill in your PostgreSQL connection string:

```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/propcrm?schema=public"
```

Generate secure JWT secrets (run this twice — once for each secret):

```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Paste the outputs into `JWT_SECRET` and `JWT_REFRESH_SECRET` in the `.env` file.
The backend runs on **port 5001** (port 5000 is reserved by Docker Desktop).
Make sure `PORT=5001` is set in `backend/.env`.

---

### Step 2 — Set Up the Database

From inside the `backend/` folder:

```
npx prisma generate
npx prisma db push --accept-data-loss
node prisma/seed.js
```

`db push` creates all tables from the Prisma schema.
`seed.js` populates the database with demo data: 7 agents, 8 properties, 6 leads, 10 deals, 8 clients, 14 tasks.

---

### Step 3 — Install Dependencies

Backend (from `backend/`):

```
npm install
```

Frontend (from the project root):

```
npm install
```

---

### Step 4 — Start the Servers

Open two terminal windows.

**Terminal 1 — Backend:**

```
cd backend
npm run dev
```

Backend runs at: `http://localhost:5001`

**Terminal 2 — Frontend:**

```
npm run dev
```

Frontend runs at: `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

### Default Login Credentials (after seeding)

| Email                | Password    | Role  |
|----------------------|-------------|-------|
| admin@propcrm.io     | password123 | admin |
| sarah.j@propcrm.io   | password123 | agent |
| marcus.c@propcrm.io  | password123 | agent |

---

### Quick Start (Windows only)

Double-click `start.bat` in the project root. It checks for `.env`, installs
dependencies if needed, runs Prisma setup, and launches both servers in separate
terminal windows automatically.

---

---

## What Has Been Built and Is Working

### Frontend — 8 Pages (React + Vite + Tailwind)

| Page | What It Does | API Connected |
|---|---|---|
| Login | JWT authentication, token storage, redirect on expiry | Yes |
| Dashboard | KPI cards, portfolio hero, revenue chart, top agents, closing deals, hot leads, alerts | Yes |
| Properties | Grid/list toggle, filters by neighborhood/type/beds/price, add/edit/delete, detail drawer | Yes |
| Leads | Funnel bar, source breakdown, stage columns, add/edit/archive, detail drawer | Yes |
| Deals | Kanban board by deal stage, risk filters, commission panel, add/edit, detail drawer | Yes |
| Agents | Tier tabs (elite/core/developing), region/sort filters, performance drawer, leaderboard | Yes |
| Clients | Summary bar, tier/type/status filters, add/edit/delete, referral panel, detail drawer | Yes |
| Tasks | Summary bar, category/priority/status filters, add/edit/complete/archive, workflow panel | Yes |
| Analytics | Revenue chart, forecast panel, channel ROI panel, agent cohort, KPI cards | **No — uses mock data** |

**Shared infrastructure:**
- `src/lib/api.js` — Fetch wrapper with JWT Authorization header and automatic 401 token refresh
- `src/lib/mappers.js` — Translates API response shapes to the field names the UI components expect
- `src/context/AuthContext.jsx` — Global auth state, login/logout, loading guard
- `vite.config.js` — Dev proxy: `/api` and `/uploads` forwarded to `http://localhost:5001`, no CORS issues

---

### Backend — Node.js + Express + Prisma + PostgreSQL

Runs on port 5001. All endpoints are under `/api`.

**Route groups:**

| Route | Endpoints |
|---|---|
| `/api/auth` | register, login, logout, refresh-token, /me |
| `/api/dashboard` | summary KPIs, revenue series, pipeline, top agents, closing-soon |
| `/api/properties` | full CRUD, soft delete, pagination, filtering, comps, market analysis, photo upload |
| `/api/leads` | full CRUD, funnel stats, lead scoring, merge, convert to deal |
| `/api/deals` | full CRUD, stage advancement, commission record, document upload |
| `/api/agents` | read + update, performance metrics, leaderboard, retention risk |
| `/api/clients` | full CRUD, lifetime value breakdown, referral tracking |
| `/api/tasks` | full CRUD, overdue tracking, subtasks, auto-generate on deal stage change |
| `/api/analytics` | revenue by period/segment/type, forecast, channel ROI, agent cohort, lead funnel |
| `/api/files` | multipart file upload (multer), file metadata stored in DB |
| `/api/notifications` | in-app inbox, mark read/read-all |
| `/api/admin` | maintenance (vacuum/reindex/analyze), commission admin, audit log, GDPR erasure |

**Business logic services:**
- Commission 7-day hold lifecycle (hold → released → paid → adjusted/voided)
- Lead scoring algorithm
- Agent retention risk scoring
- Task auto-creation when deals advance stages
- Lead-to-deal conversion tracking
- Nightly database maintenance scheduler (VACUUM, ANALYZE, REINDEX, CLUSTER)

**Database — 14 Prisma models:**
`User`, `Agent`, `Property`, `Lead`, `Deal`, `Client`, `Task`, `CommissionRecord`,
`CommissionAdjustment`, `Notification`, `AuditLog`, `File`,
plus relation models `LeadInteraction`, `DealMilestone`, `DealDocument`, `ClientTransaction`

Every model has:
- `isDeleted` soft delete (no hard deletes anywhere)
- `version` field for optimistic concurrency
- Strategic indexes on all foreign keys and high-cardinality filter columns

**Other:**
- Docker support: `Dockerfile` and `.dockerignore` exist for both frontend and backend
- `start.bat` Windows launcher with local and Docker modes
- Seed script with realistic demo data

---

---

## What Is Still Missing

### 1. Analytics Page Not Connected to the API
`src/pages/AnalyticsPage.jsx` still imports everything from `src/data/analyticsData.js`
(static mock data). The backend already has working endpoints:
- `GET /api/analytics/revenue`
- `GET /api/analytics/forecast`
- `GET /api/analytics/channel-roi`
- `GET /api/analytics/agent-cohort`
- `GET /api/analytics/portfolio`

Fix: replace static imports with `useEffect` + `api.get(...)` calls, same pattern as `DashboardPage.jsx`.

---

### 2. No Agent Create Flow
Every other entity (properties, leads, deals, clients, tasks) has an Add modal.
`AgentsPage` can only read agents — there is no way to create one from the UI.
Creating an agent requires two steps: first create a `User` (email + password via
`/api/auth/register`), then create the linked `Agent` record. This needs an
admin-only modal in `AgentsPage.jsx`.

---

### 3. No File Upload UI
The backend has a working multer-based upload controller at `/api/files`, but no
frontend component exposes it. Property photos and deal documents cannot be
uploaded from the UI. An upload button or dropzone needs to be added inside
`PropertyDrawer.jsx` and `DealDrawer.jsx`.

---

### 4. External Notification Delivery Not Wired
Notifications are written to the database and visible in the in-app inbox, but no
emails or SMS messages are actually sent. The adapters in `backend/server.js` are
explicitly set to `null` stubs:
- Email: SendGrid (`SENDGRID_API_KEY` env var ready, adapter not wired)
- SMS: Twilio (not installed)
- Push: Firebase (not installed)

---

### 5. Dead Mock Data Arrays in `src/data/`
Several files in `src/data/` contain entity arrays that are no longer used because
those pages now fetch from the API. They are dead code and should be removed:

| File | Used for (keep) | Dead code (remove) |
|---|---|---|
| `src/data/leadsData.js` | `leadSources` display config | `leads` array |
| `src/data/agentsData.js` | `tierConfig` color/label map | `agents` array |
| `src/data/clientsData.js` | `tierConfig`, `referralLeaderboard` | `clients` array |
| `src/data/tasksData.js` | `workflowTemplates`, `categories`, `priorities` | `tasks` array |
| `src/data/analyticsData.js` | Everything (AnalyticsPage) | Remove after connecting to API |

---

### 6. No docker-compose.yml
A `Dockerfile` exists for both frontend and backend, but there is no
`docker-compose.yml` to spin up the full stack (PostgreSQL + backend + frontend)
with a single command. The Docker mode in `start.bat` references this file but
it does not exist yet.

---

### 7. No Automated Tests
Zero tests exist despite complex business logic. The commission lifecycle,
lead scoring, task automation, and maintenance scripts are all untested.
The test infrastructure (Jest + Supertest) is already installed in the backend
`devDependencies` and a `jest.config.js` exists — only the test files are missing.

---

### 8. No CI/CD Pipeline
The `.github/workflows/` folder exists but is empty. No pipeline runs migrations,
seeds, or tests on push or pull request.

---

---

## Problems Found and Fixed During This Session

### Problem 1 — BAT File Would Not Open (Fixed)
**Cause:** `start.bat` was saved as UTF-8 and contained Unicode box-drawing
characters (`═` U+2550, `─` U+2500) in comment lines. Windows Command Prompt
runs in ANSI codepage and cannot parse those characters, causing the file to
fail silently on launch.
**Fix:** Replaced all Unicode box-drawing characters with ASCII equivalents
(`=` and `-`) and re-saved the file as ANSI encoding.

---

### Problem 2 — Backend Could Not Start (Fixed)
**Cause:** Docker Desktop occupies port 5000 for its own internal backend service.
The PropCRM backend was configured to bind to port 5000, so it crashed immediately
on startup with an address-in-use error.
**Fix:** Changed `PORT=5000` to `PORT=5001` in `backend/.env`, updated the
Vite proxy target in `vite.config.js` from `localhost:5000` to `localhost:5001`,
and updated the display URLs in `start.bat` to match.

---

### Problem 3 — PropertyCards Crashed the Frontend (Fixed)
**Cause:** `src/components/PropertyCards.jsx` called `p.change.toFixed(1)` without
guarding against `p.change` being `undefined`. When the API returns property
objects that do not include a `change` field, the component threw a TypeError and
crashed the entire React tree.
**Fix:** Added `?? 0` null-coalescing fallback on both `p.change` and `p.changePct`
throughout the component so it renders safely regardless of whether the field is
present in the data.
