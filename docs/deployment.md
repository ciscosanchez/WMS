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

CI/CD: GitHub Actions runs validate (typecheck + lint + prettier + test + build), then auto-deploys to Hetzner on push to `main`.

Current production deploy path:

- SSH user: `deploy`
- SSH port: `49502`
- remote compose path: `/root/apps/wms/infra/docker-compose.prod.yml`

### Tenant Database Migrations

After adding new schema models, run migrations on each tenant:

```bash
# Connect to prod server
ssh -p 49502 deploy@<server-ip>

# Preferred rollout path
cd /root/apps/wms
npm run db:reconcile:tenants   # one-time on legacy environments
npm run db:migrate:tenants
```

This replaces the earlier manual loop for most normal rollout cases.

### Environment

All configuration via environment variables. See `infra/.env.prod.example` for the full list. Key variables documented in README.md.

### Monitoring

- **Sentry**: Error tracking (DSN via `SENTRY_DSN` env var)
- **Docker logs**: `docker compose -f docker-compose.prod.yml logs -f wms`
