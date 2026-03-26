# Production Reconciliation

## Verified On Production

Date checked: `2026-03-25`

These facts were verified directly against the production VPS and Postgres instance:

- `public.users` now contains `auth_version`
- the public database does not contain `_prisma_migrations`
- active schemas present in the production database:
  - `public`
  - `armstrong`
  - `tenant_armstrong`
  - `tenant_diego_family`
- base table counts:
  - `public`: `6`
  - `armstrong`: `76`
  - `tenant_armstrong`: `76`
  - `tenant_diego_family`: `78`

This means production is closer to the repo schema than the first audit suggested, but it is
still not aligned with Prisma migration history because `_prisma_migrations` is missing.

## What The Dirty Prod Worktree Told Us

The server worktree had uncommitted changes. They break down into three categories.

Likely valid hotfixes:

- `src/modules/workflow-rules/actions.ts`
  - fixes an import mismatch by using `workflowRuleSchemaStatic as ruleSchema`
- `src/modules/customs/actions.ts`
  - updates audit logging calls to match the current `logAudit()` contract
- `infra/docker-compose.prod.yml`
  - adds the `watchdog` service and volume

Historical evidence of schema drift:

- `prisma/schema.prisma.prod-dirty-20260325.bak`
  - captured an earlier prod-side snapshot from before `auth_version` was present
  - useful as historical evidence, but no longer matches the live `public.users` table

Junk / cleanup items:

- `here: { email: credentials.email as string },`
  - zero-byte shell redirection debris
- `infra/docker-compose.prod.yml.bak*`
  - backup files only

## Current Deployment Problem

The WMS app image can build and the container starts healthy, but the deploy script still fails in the Prisma migration phase.

Observed failure modes:

1. Production migration-history mismatch
   - repo Prisma expects `_prisma_migrations`
   - production still has none, so `prisma migrate deploy` cannot be treated as authoritative

2. Baseline migration ambiguity
   - the repo now contains a public baseline migration at `prisma/migrations/20260409120000_baseline/`
   - production has not been stamped with that history yet

Operationally, the app can now deploy and stay healthy because `infra/deploy.sh` skips Prisma
migrations when `_prisma_migrations` is missing, but the migration history gap still exists.

## Recommended Sequence

1. Treat the live prod DB as the current source of truth.
2. Treat `prisma/migrations/20260409120000_baseline/` as a candidate baseline, not an applied fact.
3. Decide how to handle legacy tenant schemas:
   - `armstrong`
   - `tenant_armstrong`
4. Keep the follow-up public-schema delta in `prisma/migrations/20260326000000_add_missing_user_fields/`.
5. Use `scripts/reconcile-prod-db.sql` only as a one-time reconciliation tool after the team agrees the migration list matches live reality.
6. Decide whether the legacy `armstrong` schema should be retained, migrated, or removed.

## Immediate Safe Actions

- keep the watchdog compose change
- remove junk files from the server worktree
- avoid assuming `prisma migrate deploy` is authoritative on prod until the schema is baselined
- use direct schema inspection, not the old prod backup file, as the source of truth
- keep any prod reconciliation SQL idempotent and one-time, not part of the normal deploy path

## Not Yet Resolved

- whether `prisma/migrations/20260409120000_baseline/` exactly matches live prod and can be stamped safely
- whether `scripts/reconcile-prod-db.sql` should be kept as an emergency/manual recovery tool after prod is fully baselined
- whether `armstrong` is legacy and can be removed, or is still in active use
- whether tenant schema evolution should continue via raw SQL migrations, Prisma tenant schema management, or a hybrid approach
