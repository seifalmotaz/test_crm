#!/bin/sh
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Estate CRM Backend — Dev container      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "▶ Waiting for database..."
# Postgres container has its own healthcheck, but we add a small extra wait
# in case the connection string resolves before the DB accepts connections.
for i in 1 2 3 4 5 6 7 8 9 10; do
  if bun -e "import postgres from 'postgres'; const c = postgres(process.env.DATABASE_URL, { max: 1 }); await c\`SELECT 1\`; await c.end();" 2>/dev/null; then
    echo "  ✓ Database is reachable"
    break
  fi
  echo "  …retrying ($i/10)"
  sleep 2
done

echo "▶ Running database migrations..."
bun src/db/migrate.ts

echo "▶ Seeding test data (idempotent — safe to re-run)..."
bun src/db/seed.ts || echo "  ! Seed step failed (often fine if data already exists). Continuing."

echo ""
echo "▶ Starting backend on port 3000..."
echo "  API:    http://localhost:3000"
echo "  Docs:   http://localhost:3000/api/docs"
echo ""

exec "$@"
