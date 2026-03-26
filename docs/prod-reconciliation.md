# Production Reconciliation

## Status

Prepared on 2026-03-26. Not yet a routine automatic deploy step.

This document is the runbook for the one-time Prisma baseline reconciliation on
production. The repo now contains the required migration artifacts and an
idempotent SQL script, but the actual transition should still happen during an
explicit maintenance window.

## Why This Is Still Manual

This is not a normal schema migration.

The production database drifted before Prisma migration history was being
tracked consistently. Running the reconciliation does two high-impact things:

- mutates the live `public` schema if anything is missing
- creates and seeds `_prisma_migrations`, which changes how every future
  `prisma migrate deploy` behaves

That means the risky part is not the SQL itself. The risky part is stamping the
history incorrectly and teaching deploys the wrong baseline forever.

## What Was Wrong

Checked on 2026-03-25:

- `public.users` was missing:
  - `auth_version`
  - `locale`
  - `password_set_token`
  - `password_set_expires`
- `public.tenant_users` was missing:
  - `portal_client_id`
- `public._prisma_migrations` did not exist
- active schemas included:
  - `public`
  - `armstrong`
  - `tenant_armstrong`
  - `tenant_diego_family`

## Repo Artifacts

Prepared in repo:

- [reconcile-prod-db.sql](/Users/cisco.sanchez/Sales/armstrong/wms/scripts/reconcile-prod-db.sql)
- [check-prisma-baseline.sh](/Users/cisco.sanchez/Sales/armstrong/wms/scripts/check-prisma-baseline.sh)
- [migration.sql](/Users/cisco.sanchez/Sales/armstrong/wms/prisma/migrations/20260326000000_add_missing_user_fields/migration.sql)

Expected public migration chain:

1. `20260317145051_init_tenant_schema`
2. `20260317145059_init_public_schema`
3. `20260325215500_add_auth_version_to_users`
4. `20260326000000_add_missing_user_fields`

## Go / No-Go Checklist

Only do the explicit reconciliation when all of these are true:

1. No active feature churn touching `public.users`, `tenant_users`, auth, or tenant membership.
2. A fresh production Postgres backup exists.
3. The current live `public` schema matches the intended migration chain.
4. The operator running the change has verified whether legacy schemas like `armstrong`
   are still needed.
5. The deploy owner understands this is a one-time transition, not a normal deploy step.

## Preflight

Run the baseline status check first:

```bash
./scripts/check-prisma-baseline.sh
```

Or on the server:

```bash
ssh ramola "cd /root/apps/wms && ./scripts/check-prisma-baseline.sh"
```

What you want to confirm:

- whether `public._prisma_migrations` exists
- which public migrations are already registered
- whether each `tenant_%` schema has its own `_prisma_migrations`

## Backup

Take a fresh backup before doing anything else:

```bash
ssh ramola "cd /root/apps/wms && docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U ramola -d ramola_wms > /tmp/ramola_wms_pre_prisma_reconcile.sql"
```

Or equivalent backup procedure already used for production.

## Execution

Run the public-schema reconciliation once:

```bash
ssh ramola "cd /root/apps/wms && docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  psql -U ramola -d ramola_wms" < scripts/reconcile-prod-db.sql
```

Then verify Prisma sees the expected baseline:

```bash
ssh ramola "cd /root/apps/wms && docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  psql -U ramola -d ramola_wms -c 'SELECT migration_name, finished_at FROM public._prisma_migrations ORDER BY migration_name;'"
```

After that, run deploy-time Prisma normally:

```bash
ssh ramola "cd /root/apps/wms && docker compose -f infra/docker-compose.prod.yml exec -T wms \
  node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma"
```

The expected result is a no-op for the already-baselined public migrations.

## Tenant Schema Warning

This runbook only baselines the `public` schema.

The deploy path also runs:

```bash
node node_modules/prisma/build/index.js migrate deploy --schema=prisma/tenant-schema.prisma
```

If existing tenant schemas such as `tenant_armstrong` or `tenant_diego_family`
also lack `_prisma_migrations`, they may need their own one-time reconciliation
plan. Do not assume the public-schema baseline fixes tenant-schema history.

## Deploy Behavior

`infra/deploy.sh` should not silently stamp production anymore.

The safe behavior is:

- check for `public._prisma_migrations`
- fail with clear instructions if it is missing
- only run `prisma migrate deploy` once the explicit reconciliation has been done

That keeps the "yes, now" moment deliberate.

## Still Open

- Decide whether legacy schema `armstrong` is still in use or safe to drop.
- Verify tenant-schema migration history for existing `tenant_%` schemas.
- Confirm Prisma CLI availability inside the runtime container long-term.
- Execute the one-time maintenance window when you are ready to say "yes, now."
