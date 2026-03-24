# Deployment Guide

## Production Environment

Ramola WMS runs on a Hetzner CPX21 VPS via Docker Compose with Traefik handling TLS termination (Let's Encrypt auto-renewal).

### Stack

| Service      | Image              | Purpose                                          |
| ------------ | ------------------ | ------------------------------------------------ |
| **wms**      | Node.js standalone | Next.js app (App Router + Server Actions)        |
| **cron**     | Alpine + crond     | Scheduled jobs (Shopify sync, billing, tracking) |
| **postgres** | PostgreSQL 16      | Public + tenant schemas                          |
| **redis**    | Redis 7            | BullMQ job queues, caching                       |
| **minio**    | MinIO              | S3-compatible object storage (labels, documents) |
| **traefik**  | Traefik v3         | Reverse proxy, TLS termination                   |

### Deploy

```bash
cd infra
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans wms
```

CI/CD: GitHub Actions runs validate (typecheck + lint + prettier + test + build), then auto-deploys to Hetzner via SSH on push to `main`.

### Tenant Database Migrations

After adding new schema models, run migrations on each tenant:

```bash
# Connect to prod server
ssh -p 49502 root@<server-ip>

# Apply migrations
cd /root/apps/wms
for schema in $(psql $DATABASE_URL -t -c "SELECT db_schema FROM tenants WHERE status='active'"); do
  psql $WMS_DATABASE_URL -c "SET search_path TO $schema" -f prisma/tenant-migrations/XXXX_name.sql
done
```

### Environment

All configuration via environment variables. See `infra/.env.prod.example` for the full list. Key variables documented in README.md.

### Monitoring

- **Sentry**: Error tracking (DSN via `SENTRY_DSN` env var)
- **Docker logs**: `docker compose -f docker-compose.prod.yml logs -f wms`
