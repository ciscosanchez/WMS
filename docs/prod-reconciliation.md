# Production Reconciliation

## Verified On Production

Date checked: `2026-03-25`

These facts were verified directly against the production VPS and Postgres instance:

- `public.users` does not contain `auth_version`
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

This means production is not currently aligned with the Prisma history expected by the repo.

## What The Dirty Prod Worktree Told Us

The server worktree had uncommitted changes. They break down into three categories.

Likely valid hotfixes:

- `src/modules/workflow-rules/actions.ts`
  - fixes an import mismatch by using `workflowRuleSchemaStatic as ruleSchema`
- `src/modules/customs/actions.ts`
  - updates audit logging calls to match the current `logAudit()` contract
- `infra/docker-compose.prod.yml`
  - adds the `watchdog` service and volume

Evidence of schema drift:

- `prisma/schema.prisma`
  - closer to the live production DB than `main`
  - notably does not include `authVersion` on `User`

Junk / cleanup items:

- `here: { email: credentials.email as string },`
  - zero-byte shell redirection debris
- `infra/docker-compose.prod.yml.bak*`
  - backup files only

## Current Deployment Problem

The WMS app image can build and the container starts healthy, but the deploy script still fails in the Prisma migration phase.

Observed failure modes:

1. Production DB/schema mismatch
   - repo Prisma expects schema state that prod does not currently have
   - `auth_version` is one concrete example

2. Runtime Prisma CLI dependency mismatch
   - the runtime image currently copies a partial Prisma CLI tree
   - `node node_modules/prisma/build/index.js migrate deploy ...` fails because transitive Prisma dependencies are missing at runtime

Operationally, this means the app can be up while `infra/deploy.sh` still exits non-zero.

## Recommended Sequence

1. Treat the live prod DB as the current source of truth.
2. Capture a committed baseline of the prod public schema before adding more schema changes.
3. Decide how to handle legacy tenant schemas:
   - `armstrong`
   - `tenant_armstrong`
4. Upstream valid prod hotfixes before more deploy work.
5. Fix the runtime image / deploy path so Prisma CLI has its full dependency tree if it must run in the app container.
6. Reintroduce proper Prisma migration history only after the baseline is settled.

## Immediate Safe Actions

- commit the valid app hotfixes from prod into the repo
- keep the watchdog compose change
- remove junk files from the server worktree
- avoid assuming `prisma migrate deploy` is authoritative on prod until the schema is baselined

## Not Yet Resolved

- whether `authVersion` should be applied to prod now or deferred until after baseline
- whether `armstrong` is legacy and can be removed, or is still in active use
- whether tenant schema evolution should continue via raw SQL migrations, Prisma tenant schema management, or a hybrid approach
