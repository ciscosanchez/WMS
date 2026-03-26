#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
POSTGRES_USER="${POSTGRES_USER:-ramola}"
WMS_DB="${WMS_DB:-ramola_wms}"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$WMS_DB" <<'SQL'
\echo '== Public Prisma history =='
SELECT to_regclass('public._prisma_migrations') AS public_prisma_history;

\echo ''
\echo '== Registered public migrations =='
SELECT migration_name, finished_at
FROM public._prisma_migrations
ORDER BY migration_name;

\echo ''
\echo '== Tenant schema Prisma history =='
SELECT
  n.nspname AS schema_name,
  to_regclass(format('%I._prisma_migrations', n.nspname)) IS NOT NULL AS has_prisma_history
FROM pg_namespace n
WHERE n.nspname LIKE 'tenant\_%' ESCAPE '\'
ORDER BY n.nspname;
SQL
