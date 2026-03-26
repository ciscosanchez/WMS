#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Pulling latest images..."
docker compose -f docker-compose.prod.yml pull

echo "==> Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "==> Waiting for postgres to be ready..."
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U "${POSTGRES_USER:-ramola}" --timeout=30

has_public_prisma_history=$(
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "${POSTGRES_USER:-ramola}" -d "${POSTGRES_DB:-ramola}" \
    -Atqc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;"
)

if [ "$has_public_prisma_history" != "t" ]; then
  echo "==> _prisma_migrations not found — running one-time reconciliation..."
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "${POSTGRES_USER:-ramola}" -d "${POSTGRES_DB:-ramola}" \
    < "$SCRIPT_DIR/../scripts/reconcile-prod-db.sql"
  echo "==> Reconciliation complete."
fi

echo "==> Running WMS Prisma migrations..."
docker compose -f docker-compose.prod.yml exec -T wms \
  node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
docker compose -f docker-compose.prod.yml exec -T wms \
  node node_modules/prisma/build/index.js migrate deploy --schema=prisma/tenant-schema.prisma

echo "==> Health check..."
sleep 5
for svc in wms docai dispatch; do
  status=$(docker compose -f docker-compose.prod.yml ps --format json "$svc" | grep -o '"Status":"[^"]*"' | head -1)
  echo "  $svc: $status"
done

echo ""
echo "==> Deploy complete!"
echo "  WMS:      https://wms.ramola.app"
echo "  Dispatch: https://dispatch.ramola.app"
echo "  DocAI:    internal (http://docai:3002)"
