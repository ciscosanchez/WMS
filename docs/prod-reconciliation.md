# Production Reconciliation

## Status: Resolved (2026-03-26)

The schema drift between the production database and the Prisma migration history
has been addressed. The deploy path now handles the transition automatically.

---

## What Was Wrong (checked 2026-03-25)

- `public.users` was missing: `auth_version`, `locale`, `password_set_token`, `password_set_expires`
- `public.tenant_users` was missing: `portal_client_id`
- No `_prisma_migrations` table existed — Prisma had no history of what had been applied
- Active schemas on prod: `public`, `armstrong`, `tenant_armstrong`, `tenant_diego_family`
- A broken baseline migration (`20260409120000_baseline`) existed in the repo using full
  `CREATE TABLE` statements that would fail on any database where those tables already existed

Prod worktree had uncommitted changes in three categories:
- Valid hotfixes: `workflow-rules/actions.ts` import fix, `customs/actions.ts` audit log fix,
  `docker-compose.prod.yml` watchdog service addition
- Schema drift: `prisma/schema.prisma` lacked `authVersion` on `User`
- Junk: stray shell redirection line, `docker-compose.prod.yml.bak*` backup files

---

## What Was Fixed (2026-03-26)

### Migrations (repo)

1. **Deleted** `prisma/migrations/20260409120000_baseline` — full `CREATE TABLE` migration
   that conflicted with both fresh installs and existing databases.

2. **Added** `prisma/migrations/20260326000000_add_missing_user_fields` — correct additive
   migration using `ALTER TABLE ... ADD COLUMN` for all missing fields:
   - `users.locale`, `users.password_set_token`, `users.password_set_expires`
   - `tenant_users.portal_client_id`
   - Missing non-unique indexes: `tenant_users_tenant_id_idx`, `tenant_users_user_id_idx`,
     `sessions_user_id_idx`
   - Unique index: `users_password_set_token_key`

### One-time prod reconciliation script

`scripts/reconcile-prod-db.sql` — idempotent SQL that:
- Adds all missing columns via `ADD COLUMN IF NOT EXISTS`
- Creates `_prisma_migrations` if absent
- Registers all 4 migrations as already applied (`WHERE NOT EXISTS` guard, safe to re-run)

Run manually if needed:
```bash
psql "$DATABASE_URL" -f scripts/reconcile-prod-db.sql
```

Or from the server:
```bash
docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  psql -U ramola -d ramola < scripts/reconcile-prod-db.sql
```

### Deploy path (deploy.sh)

Now handles the transition automatically:
1. Checks for `_prisma_migrations`
2. If absent, pipes `reconcile-prod-db.sql` into the postgres container
3. Then runs `prisma migrate deploy` unconditionally — future migrations apply normally

---

## Still Open

- **`armstrong` schema** — a legacy schema that predates `tenant_armstrong`. Needs a manual
  decision: still in use, or safe to drop?
- **Prisma CLI at runtime** — `deploy.sh` uses `node node_modules/prisma/build/index.js`
  inside the app container. Verify the Docker image includes Prisma's full CLI dependency
  tree, or switch to `npx prisma` if npx is available in the image.
- **Tenant schema migration history** — `deploy.sh` also runs
  `prisma migrate deploy --schema=prisma/tenant-schema.prisma`. If existing tenant schemas
  (`tenant_armstrong`, `tenant_diego_family`) also lack `_prisma_migrations`, this will fail.
  A separate per-tenant reconciliation step may be needed — similar to the public schema fix
  but scoped per tenant.
- **Prod worktree hotfixes** — the three valid hotfixes noted above should be upstreamed
  and committed to the repo before the next deploy if they haven't been already.
