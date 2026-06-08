#!/bin/sh
set -e

echo "Running database migrations..."
bun src/db/migrate.ts

echo "Starting app..."
exec "$@"
