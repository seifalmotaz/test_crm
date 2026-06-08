#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────
# Decode base64 JWT keys if they were provided.
# This avoids multi-line values breaking Docker Compose .env files.
# ─────────────────────────────────────────────────────────────
if [ -n "$JWT_PRIVATE_KEY_B64" ]; then
  export JWT_PRIVATE_KEY=$(echo "$JWT_PRIVATE_KEY_B64" | base64 -d)
fi

if [ -n "$JWT_PUBLIC_KEY_B64" ]; then
  export JWT_PUBLIC_KEY=$(echo "$JWT_PUBLIC_KEY_B64" | base64 -d)
fi

echo "Running database migrations..."
bun src/db/migrate.ts

echo "Starting app..."
exec "$@"
