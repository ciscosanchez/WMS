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

echo "==> Running WMS Prisma migrations..."
docker compose -f docker-compose.prod.yml exec wms npx prisma migrate deploy --schema=prisma/schema.prisma
docker compose -f docker-compose.prod.yml exec wms npx prisma migrate deploy --schema=prisma/tenant-schema.prisma

echo "==> Running DispatchPro Drizzle migrations..."
docker compose -f docker-compose.prod.yml exec dispatch npx drizzle-kit migrate

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
