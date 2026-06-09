#!/usr/bin/env bash
# ────────────────────────────────────────────
# Estate CRM — One-command dev startup
# ────────────────────────────────────────────
# What this does:
#   1. Verifies Docker is running
#   2. Creates a .env file with safe local defaults (only if missing)
#   3. Starts the dev stack (Postgres, Redis, MinIO, Backend, Web)
#   4. Streams logs to the terminal
# ────────────────────────────────────────────
set -e

# Colors for friendly output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Resolve project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ────────────────────────────────────────────
# Banner
# ────────────────────────────────────────────
echo ""
echo "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo "${BLUE}║       Estate CRM — Dev Startup          ║${NC}"
echo "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ────────────────────────────────────────────
# 1. Pre-flight: Docker must be running
# ────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "${RED}✗ Docker is not installed.${NC}"
  echo "  Install Docker Desktop: https://docs.docker.com/desktop/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "${RED}✗ Docker is not running.${NC}"
  echo "  Open Docker Desktop and wait for it to finish starting."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "${RED}✗ 'docker compose' is not available.${NC}"
  echo "  Update Docker Desktop to the latest version."
  exit 1
fi

echo "${GREEN}✓${NC} Docker is running"

# ────────────────────────────────────────────
# 2. Create .env from .env.example if missing
# ────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "${YELLOW}→${NC} Creating .env from .env.example with local-dev defaults"
    cp .env.example .env
  else
    echo "${YELLOW}→${NC} Creating a fresh .env with local-dev defaults"
    cat > .env <<'EOF'
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/estate_crm?sslmode=disable
DATABASE_URL_TEST=postgresql://postgres:devpass@localhost:5433/estate_crm_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-only-change-in-production-please-1234567890
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:5173
S3_BUCKET=estate-crm-dev
S3_REGION=us-east-1
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_ENDPOINT=http://localhost:9000
MINIO_BROWSER=on
VITE_API_URL=
EOF
  fi
fi

# ────────────────────────────────────────────
# 3. Friendly port-conflict warnings (not fatal — Docker will just fail)
# ────────────────────────────────────────────
for port in 3000 5173 5432 6379 9000 9001; do
  if (echo >/dev/tcp/localhost/$port) 2>/dev/null; then
    echo "${YELLOW}!${NC} Port $port is already in use on localhost. The stack may fail to start."
  fi
done

# ────────────────────────────────────────────
# 4. Start the dev stack
# ────────────────────────────────────────────
COMPOSE_FILE="docker-compose.dev.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "${RED}✗ $COMPOSE_FILE not found in $(pwd)${NC}"
  exit 1
fi

echo "${GREEN}✓${NC} Starting dev stack..."
echo ""
echo "  ${BLUE}Web app:    http://localhost:5173${NC}"
echo "  ${BLUE}API:        http://localhost:3000${NC}"
echo "  ${BLUE}Swagger:    http://localhost:3000/api/docs${NC}"
echo "  ${BLUE}MinIO:      http://localhost:9001 (minioadmin / minioadmin)${NC}"
echo ""
echo "  ${YELLOW}First run takes 2-5 minutes (downloading images).${NC}"
echo "  ${YELLOW}Subsequent runs take ~10 seconds.${NC}"
echo ""
echo "  ${GREEN}Log-in accounts (created by the seeder):${NC}"
echo "    • super@admin.com  / super123!    (Super Admin)"
echo "    • admin@test.com   / admin123!    (Org Admin)"
echo "    • manager@test.com / manager123!  (Manager)"
echo "    • agent@test.com   / agent123!    (Agent)"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# Pass through any extra args (e.g. ./scripts/dev.sh --build)
exec docker compose -f "$COMPOSE_FILE" up "$@"
