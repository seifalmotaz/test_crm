# Database Migration Workflow

## Current state — action required

`backend/prisma/migrations/` does not exist yet, and the project has not been
initialised as a git repository.

Before CI can pass, do both of the following **once**:

```bash
# 1. Generate the initial migration from the current schema
cd backend
npx prisma migrate dev --name init
# This creates backend/prisma/migrations/YYYYMMDDHHMMSS_init/

# 2. Initialise git and commit everything, including migrations
cd ..
git init
git add .
git commit -m "chore: initial commit with schema and migration"
```

Migrations **must be committed to source control**. The CI workflow
(`.github/workflows/ci.yml` line 72) runs `prisma migrate deploy`, which
replays committed migration files against the target database. If the
`migrations/` directory is absent, CI silently applies nothing and the
database schema diverges from the code.

---

## Creating a new migration (development)

Whenever you change `backend/prisma/schema.prisma`:

```bash
cd backend
npx prisma migrate dev --name <short_description>
# e.g. npx prisma migrate dev --name add_property_views_index
```

`migrate dev`:
- Diffs the schema against the current dev database
- Generates a new timestamped migration file under `backend/prisma/migrations/`
- Applies it immediately to your local database
- Re-runs `prisma generate` to update the Prisma client

Commit the new migration file together with the schema change in the same PR.
Reviewers must be able to read the generated SQL to assess data-safety.

---

## Applying migrations in staging and production

Never run `migrate dev` against a shared database. Use `migrate deploy` instead:

```bash
cd backend
npx prisma migrate deploy
```

`migrate deploy`:
- Applies only pending (un-applied) migration files in chronological order
- Never generates new files or prompts interactively
- Is idempotent — safe to run in CI on every deploy

The CI pipeline runs this automatically. For manual staging/prod deploys,
`DATABASE_URL` must point at the target database before running the command.

---

## Handling conflicts

**Two developers created migrations from the same baseline:**

1. Identify which migration was merged to main first.
2. The second developer rebases their branch onto main, then runs:
   ```bash
   npx prisma migrate dev --name <description>
   ```
   This regenerates a migration from the updated baseline, superseding the
   conflicting file.
3. Delete the old conflicting migration file and push the regenerated one.

**Migration failed mid-apply in production:**

1. Do not re-run `migrate deploy` — Prisma records failed migrations in the
   `_prisma_migrations` table and will skip them on the next run.
2. Fix the root cause (data issue, constraint violation, etc.).
3. Either fix the migration file and mark the row as `rolled_back` in
   `_prisma_migrations`, or create a new corrective migration.
4. Re-run `migrate deploy`.

**Schema drift (database differs from migration history):**

```bash
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

This prints the SQL needed to bring the database back in sync without
wiping data. Review carefully before applying manually.

---

## Quick reference

| Command | When to use |
|---|---|
| `prisma migrate dev --name <x>` | Local dev: schema changed, generate + apply |
| `prisma migrate deploy` | CI / staging / prod: apply pending migrations |
| `prisma migrate status` | Check which migrations are pending |
| `prisma migrate diff ...` | Inspect schema drift without applying anything |
| `prisma db push` | Prototype only — skips migration history, never use in shared envs |
