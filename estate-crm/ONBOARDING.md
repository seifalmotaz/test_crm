# Estate CRM — Onboarding Guide

Welcome! This guide will get the **Estate CRM** project running on your machine
in **one command** — no engineering background required. By the end you'll have
the backend, the website, the database, and a log-in account ready to use.

> **TL;DR** — Open a terminal in the project folder and run:
> ```bash
> ./scripts/dev.sh
> ```
> Then open **<http://localhost:5173>** in your browser and log in. That's it. ✨
>
> On Windows, if `./scripts/dev.sh` doesn't run, just use:
> ```bash
> docker compose -f docker-compose.dev.yml up
> ```

---

## 1. What you're installing

The project is a **multi-tenant CRM for real estate brokerages**. A single
deployment hosts many real-estate companies; each company (called an
**Organization**) gets its own users, properties, leads, and deals.

To run it locally you need five services working together:

| Service | What it does | Where it runs |
|---|---|---|
| **PostgreSQL** | Stores all data (users, properties, leads, …) | `localhost:5432` (Docker) |
| **Redis** | Caching / session helper | `localhost:6379` (Docker) |
| **MinIO** | Local "S3" for file uploads (avatars, property photos, …) | `localhost:9000` + console on `9001` (Docker) |
| **Backend API** | The NestJS server that powers the app | `localhost:3000` (Docker) |
| **Web Frontend** | The React website you actually click on | `localhost:5173` (Docker) |

Everything runs in **Docker containers** — you don't need to install Postgres,
Redis, MinIO, Node, or Bun on your machine. The only thing you *do* need is
**Docker Desktop**.

---

## 2. Prerequisites (one-time setup)

### 2.1 Install Docker Desktop

Pick your platform:

- **macOS (Apple Silicon / Intel)**: <https://docs.docker.com/desktop/install/mac-install/>
- **Windows (10/11)**: <https://docs.docker.com/desktop/install/windows-install/>
- **Linux**: <https://docs.docker.com/desktop/install/linux-install/>

After installing, **open Docker Desktop once and let it finish starting up**
(you'll see a whale icon in your menu bar / system tray turn solid). It needs
to be running whenever you start the project.

> To verify, run in any terminal:
> ```bash
> docker --version
> docker compose version
> ```
> Both commands should print a version number.

### 2.2 Get the project code

You should already have the project folder. If not, clone it:

```bash
git clone <repo-url> estate-crm
cd estate-crm
```

That's all the installing you need. 🎉

---

## 3. Start the project (the only command you need)

From the **project root** (`estate-crm/`) run:

```bash
./scripts/dev.sh
```

On macOS / Linux you may need to make it executable once:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

**On Windows**, double-click `scripts/dev.sh` in your file explorer — if
Git Bash is installed it'll run. Or just run `docker compose -f
docker-compose.dev.yml up` from PowerShell.

### What this script does

1. Creates a `.env` file with safe local defaults (DB password, JWT secret, etc.)
2. Builds the Docker images for the backend and the web frontend
3. Starts all 5 services together
4. Waits for the database to be ready
5. **Runs the database schema migrations** (creates all tables)
6. **Seeds test data** (creates an Organization, 3 users, 12 leads, etc.)
7. Streams logs to your terminal

The first run takes **2–5 minutes** (downloading images + installing
dependencies). Subsequent runs take ~10 seconds.

You'll see log output like:

```
[+] Running 5/5
 ✔ Network estate-crm-dev  Created
 ✔ Container estate-crm-postgres   Started
 ✔ Container estate-crm-redis      Started
 ✔ Container estate-crm-minio      Started
 ✔ Container estate-crm-minio-init Started
 ✔ Container estate-crm-app        Started
 ✔ Container estate-crm-web        Started
app-1   | Running database migrations...
app-1   | Migrations complete!
app-1   | Seeding database...
app-1   | Created organization: Test Brokerage
app-1   | Created super admin: super@admin.com
app-1   | Created admin user: admin@test.com
app-1   | Server running on http://localhost:3000
web-1   | VITE v5 ready in 312 ms
web-1   | ➜ Local: http://localhost:5173/
```

When you see **"Server running on http://localhost:3000"** you're good to go.

---

## 4. Open the app and log in

| URL | What it is |
|---|---|
| **<http://localhost:5173>** | **The web app — start here** |
| <http://localhost:3000/api/docs> | Backend API documentation (Swagger) |
| <http://localhost:9001> | MinIO file storage console |

### Seeded log-in accounts

After the first run, the seeder creates these accounts you can log in with:

| Role | Email | Password |
|---|---|---|
| Super Admin (cross-tenant) | `super@admin.com` | `super123!` |
| Organization Admin | `admin@test.com` | `admin123!` |
| Manager | `manager@test.com` | `manager123!` |
| Agent | `agent@test.com` | `agent123!` |

> **Heads up:** The seeded data is reset every time you re-run the seed script
> (see §7), so feel free to break things — you can always start fresh.

---

## 5. How the "log-in" cookie works (so you're not confused)

When you log in, the backend sends back **two invisible cookies** in your
browser: `access_token` and `refresh_token`. They store your session so you
don't have to log in again on every page.

A few things to know:

- **You don't need to do anything with cookies.** Just log in once and browse.
- **Cookies only work because the frontend and backend share the same host.**
  The web server (Vite) on port `5173` *proxies* any URL starting with `/api`
  to the backend on port `3000`. From the browser's perspective, the API is
  "on the same domain" — so cookies stick. If you change this, logins will
  break.
- **Cookies are `httpOnly`** — JavaScript on the page can't read them. That's
  a security feature, not a bug.
- **In production, cookies require HTTPS.** Locally we run over plain HTTP,
  which the backend allows for development. If you ever see "can't log in"
  issues, the cookie settings in `.env` are the first place to look:
  `COOKIE_SECURE`, `COOKIE_DOMAIN`, `CORS_ORIGIN`.

If you ever get logged out mysteriously, open your browser's DevTools
(**F12** → **Application** tab → **Cookies** → `http://localhost:5173`) and
check whether `access_token` and `refresh_token` are present. If not, the
backend probably returned a 401 — open the **Network** tab and look at the
`/api/auth/login` request to see the error code.

---

## 6. Common tasks

### View the API documentation

Open <http://localhost:3000/api/docs>. You can:

- See every endpoint grouped by module (Auth, Users, Leads, …)
- Click **"Authorize"** to paste a token if you want to test endpoints directly
- See all possible error codes and what they mean

### View stored files / uploaded images

Open <http://localhost:9001> and log in with the MinIO credentials in `.env`
(default: `minioadmin` / `minioadmin`). The bucket is named `estate-crm-dev`.

### Open the database GUI

The easiest way is via the Drizzle Studio script:

```bash
bun run db:studio
```

This opens a web UI at <http://local.drizzle.studio> where you can browse
every table. (Requires Bun installed; see §9 for the bare-bones install
instructions.)

### Re-seed the database (wipe + repopulate test data)

```bash
docker compose -f docker-compose.dev.yml exec app bun src/db/seed.ts
```

This **keeps** your schema (tables, columns) but resets the rows. Safe to run
multiple times.

### Hard reset the database (drop everything and rebuild)

This **deletes all data** including any test data you added. The script
re-creates the schema and re-seeds:

```bash
docker compose -f docker-compose.dev.yml exec app bun src/db/reset
```

> ⚠️ Don't run this if you've added data you want to keep.

### Stop the project (without losing data)

Press **Ctrl + C** in the terminal where `./scripts/dev.sh` is running. Or
from another terminal:

```bash
docker compose -f docker-compose.dev.yml down
```

Your database rows survive — they live in a Docker volume.

### Stop the project AND wipe all data (fresh start)

```bash
docker compose -f docker-compose.dev.yml down -v
```

The next start will rebuild the schema and re-seed from scratch.

### Tail logs for a specific service

```bash
docker compose -f docker-compose.dev.yml logs -f app     # backend
docker compose -f docker-compose.dev.yml logs -f web     # frontend
docker compose -f docker-compose.dev.yml logs -f postgres
```

Press `Ctrl + C` to stop tailing.

---

## 7. The `.env` file (what those variables mean)

The first time you run `./scripts/dev.sh` it creates a `.env` file with
working local defaults. You usually don't need to change anything. But if you
hit a weird error, here's what each variable controls:

| Variable | What it does | Default |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database login + name | `postgres` / `devpass` / `estate_crm` |
| `JWT_SECRET` | The secret used to sign login tokens. **Change this if you go to production.** | `dev-only-change-in-production-please` |
| `CORS_ORIGIN` | Which frontend URLs may call the API | `http://localhost:5173` |
| `COOKIE_DOMAIN` | Which host the session cookies are valid for | `localhost` |
| `COOKIE_SECURE` | `true` = cookies only over HTTPS. Set to `false` for local HTTP dev. | `false` |
| `VITE_API_URL` | What URL the web app calls for the API. With the Vite proxy this can be left empty. | *(empty)* |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Where uploaded files go. Pointed at local MinIO by default. | `estate-crm-dev` / `http://minio:9000` / `minioadmin` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO console login | `minioadmin` / `minioadmin` |

**Rule of thumb:** don't edit `.env` unless you know why.

---

## 8. Common "it broke" fixes

### "Port 5432 is already in use"

You have a local Postgres running outside Docker. Either:

- Stop it: `brew services stop postgresql` (macOS) / `sudo service postgresql stop` (Linux)
- Or change the dev `postgres` port in `docker-compose.dev.yml` to `5433` and update `DATABASE_URL` to match

### "Port 3000 is already in use"

You have another app on port 3000. Either stop it or change the `app`
service's port mapping in `docker-compose.dev.yml` to `"3001:3000"`.

### "I changed a backend file and the change didn't show up"

The dev image runs `bun --watch` so the backend should hot-reload. If it
doesn't:

```bash
docker compose -f docker-compose.dev.yml restart app
```

### "I changed a frontend file and the change didn't show up"

Vite has hot module replacement. Refresh the browser. If still broken:

```bash
docker compose -f docker-compose.dev.yml restart web
```

### "Login says 401 even though my password is right"

Clear your cookies for `localhost:5173` (DevTools → Application → Cookies →
right-click → Clear) and log in again. This often happens after a database
reset, where the old token is no longer valid.

### "Everything is broken, start over"

```bash
docker compose -f docker-compose.dev.yml down -v
./scripts/dev.sh
```

This is the nuclear option. It will rebuild and reseed. ~3 minutes.

---

## 9. Optional: install Bun (for running scripts directly)

You only need this if you want to run things like `bun run db:studio` or
write TypeScript files outside Docker. The web app and backend work without
Bun installed.

```bash
curl -fsSL https://bun.sh/install | bash
```

Restart your terminal. Verify with `bun --version`.

---

## 10. Where to look next

- **Project layout** — see the *Folder Structure* section of the top-level
  [`README.md`](./README.md).
- **Domain terms** (Lead, Agent, Organization, DNC, …) — see
  [`CONTEXT.md`](./CONTEXT.md). It's a glossary of the business vocabulary.
- **API surface** — open <http://localhost:3000/api/docs>.
- **Architecture decisions** — see [`docs/adr/`](./docs/adr).
- **Trouble running tests?** — see §11.

---

## 11. Running tests (optional)

Tests need a **second** Postgres database. Easiest way:

```bash
docker compose -f docker-compose.dev.yml exec app bun test
```

If tests fail with a connection error, the test database (port 5433) isn't
running. The dev compose only includes the main database. To add a test
database, copy `docker-compose.dev.yml`, add a second `postgres-test`
service, and set `DATABASE_URL_TEST` in `.env` to point at it.

---

## 12. Asking for help

When something's broken, the most useful info you can give is:

1. **What command you ran** (copy-paste, not paraphrased)
2. **What you expected to happen**
3. **What actually happened** (full error message, screenshot, or both)
4. **The output of** `docker compose -f docker-compose.dev.yml ps` (so we can
   see which containers are running / failing)

That's almost always enough to debug. Happy hacking! 🚀
