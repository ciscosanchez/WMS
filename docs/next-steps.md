# Next Steps — Production Setup

*Updated: 2026-03-21*

## Current State (March 21)

Production is live on Hetzner CPX21. Two hardening sprints completed. All operational pages wired to real data. 292 unit tests, 35 E2E tests, 0 lint errors.

### What's Actually Left

All remaining items are externally blocked or config-level (carriers settings, EDI settings, integrations test buttons still use setTimeout — acceptable for config pages).

| Priority | Item | Blocked on |
|----------|------|------------|
| 1 | UPS/FedEx/USPS sandbox credentials | Developer portal signups |
| 2 | NetSuite credentials from Armstrong | Armstrong IT |
| 3 | Hetzner Backups ($1.20/mo) | Enable in console |
| 4 | Performance tuning (DB indexes, pagination) | Load testing |
| 5 | Settings sub-pages (carriers, EDI, integrations) still use setTimeout for test/save | Low priority — config pages, not operator-critical |

### What's Done (no longer "next steps")

- ✅ Database mode live (March 17)
- ✅ Production deployment on Hetzner (March 18)
- ✅ Security + data integrity hardening (March 19)
- ✅ Armstrong operator features: dashboard, scan-out, pick path (March 20)
- ✅ Hardening sprint 1 (March 21):
  - Workflow transition guards for orders + receiving (invalid status jumps rejected)
  - Pick task generation blocks order status change on failure (no more swallowed errors)
  - Dashboard low-stock KPI fixed (was counting products WITH minStock, now counts products BELOW minStock)
  - Throughput chart uses shipment.shippedAt instead of order.updatedAt
  - Shipping rate shop + label gen fail closed (no more sandbox/demo fallbacks)
  - Putaway page wired to real receiving transactions + confirmation writes inventory
  - Discrepancies page wired to ReceivingDiscrepancy table
  - Cycle counts page wired to InventoryAdjustment (type=cycle_count)
  - Adjustments form wired to real products + bins from DB
  - All 6 lint errors fixed (0 remaining)
  - Docs updated with honest status vocabulary (demo/wired/hardened)
- ✅ Hardening sprint 2 (March 21):
  - Putaway engine suggestions wired into putaway dialog (4 strategies: fixed, zone, consolidate, closest_empty)
  - Channels page wired to SalesChannel DB with real order counts
  - Platform billing page wired to real tenant data with computed MRR/ARR
  - Putaway rules page wired to PutawayRule DB with CRUD (add/delete), real products + zones
  - Picking page wired to real PickTask DB with KPIs (pending, in_progress, completed today, short picks)
  - Settings page loads/saves from tenant.settings in public DB (no more setTimeout simulation)
  - Dashboard mockActivity removed — always uses real inventory transaction queries
  - All pages now DB-backed — no inline mock arrays remain in operational pages
- ✅ Multi-tenant credential scoping (March 21):
  - Shopify sync reads credentials from SalesChannel.config, falls back to env vars
  - Carrier adapters read from Tenant.settings via getCarrierCredentials(), env var fallback
  - Warehouse address resolved from Tenant.settings.warehouse, env var fallback
  - New getShopifyAdapterForTenant() factory for tenant-scoped Shopify calls
  - Dead carrier config module identified (src/lib/integrations/carriers/config.ts)
- ✅ Email notifications via Resend (March 21):
  - 5 email templates: shipment arrived, receiving completed, order shipped (internal), order shipped (customer), low-stock alert
  - notifyWarehouseTeam() helper: sends in-app notification + email to all admin/manager users
  - Triggers: shipment arrived, receiving completed, order shipped, low-stock after adjustment approval
  - Customer shipment email sent to order.shipToEmail when available
  - All fire-and-forget — never blocks the calling action

---

*Below is the original March 17 setup guide, preserved for reference.*

## What Changed Today (March 17)

## What Changed Today (March 17)

### Database Mode: LIVE

Switched from `USE_MOCK_DATA=true` to real PostgreSQL. All CRUD operations now persist to the database.

**Key changes:**
- `USE_MOCK_DATA=false` — all server actions hit the real DB
- `USE_MOCK_AUTH=true` — bypasses NextAuth login in dev (set `false` in prod)
- `DEFAULT_TENANT_SLUG=armstrong` — auto-resolves tenant without needing a cookie in dev
- Fixed Prisma tenant client deadlock — removed `pool.connect` monkey-patch that conflicted with `PrismaPg`'s built-in `search_path` handling (`src/lib/db/tenant-client.ts`)
- Fixed Zod schemas — empty date strings no longer crash `z.coerce.date()` (receiving + orders schemas)

### Pages Fixed (12 pages wired to real DB)

These pages were using hardcoded inline mock data. Now they all call server actions:

| Page | Was | Now |
|------|-----|-----|
| `clients/[id]/edit` | Mock data for IDs 1,2 only | `getClient(id)` from DB |
| `products/[id]/edit` | Mock data for IDs 1,2 only | `getProduct(id)` + `getClients()` |
| `products/new` | Hardcoded 3 clients | `getClients()` from DB |
| `receiving/new` | Hardcoded 3 clients | `getClients()` from DB |
| `receiving/[id]` | Always showed mock shipment #2 | `getShipment(id)` from DB |
| `warehouse/page` | Inline mock array | `getWarehouses()` from DB |
| `warehouse/[id]` | Always showed mock WH1 | `getWarehouse(id)` from DB |
| `orders/page` | Inline mock array | `getOrders()` from DB |
| `orders/[id]` | Always showed mock order #2 | `getOrder(id)` from DB |
| `orders/new` | Hardcoded clients+products, fake submit | `createOrder()` server action |
| `shipping/page` | Inline mock array | `getShipments()` from DB |
| `shipping/[id]` | Always showed mock shipment #1 | `getShipment(id)` from DB |

### New Modules Created

| Module | File | Actions |
|--------|------|---------|
| Orders | `src/modules/orders/actions.ts` | `getOrders`, `getOrder`, `createOrder`, `updateOrderStatus`, `deleteOrder` |
| Orders schema | `src/modules/orders/schemas.ts` | `orderSchema`, `orderLineSchema` |
| Shipping | `src/modules/shipping/actions.ts` | `getShipments`, `getShipment` |

### Playwright E2E Tests

Added comprehensive E2E tests with shared auth fixture pattern (reusable for DispatchPro):

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `auth.setup.ts` | — | Shared fixture: tenant cookie injection |
| `navigation.spec.ts` | 16 | Every page loads from real DB |
| `clients-crud.spec.ts` | 4 | List, create, edit, delete |
| `products-crud.spec.ts` | 2 | List, create with DB client dropdown |
| `receiving-workflow.spec.ts` | 2 | Create shipment, list |
| `warehouse-crud.spec.ts` | 3 | List, create, detail |
| `orders-workflow.spec.ts` | 3 | List, create, status advancement |
| `inventory-workflow.spec.ts` | 4 | Stock, movements, adjustments, dashboard KPIs |
| `full-journey.spec.ts` | 1 | Client → Product → Shipment end-to-end |
| **Total** | **35** | **32 passing, 3 intermittent** |

### Test Results

```
Unit tests:   124 passing (11 suites)
E2E tests:    32/35 passing (3 intermittent on complex create forms)
TypeScript:   clean (except pre-existing docai-actions.ts)
```

---

## Production Environment Setup

### 1. AWS Infrastructure (Do This First)

#### RDS PostgreSQL 16

```bash
aws rds create-db-instance \
  --db-instance-identifier ramola-wms-prod \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username ramola \
  --master-user-password <GENERATE_STRONG_PASSWORD> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --db-name ramola_wms \
  --publicly-accessible
```

After RDS is ready, run schema migrations:

```bash
# Public schema (tenants, users)
DATABASE_URL="postgresql://ramola:<password>@<rds-endpoint>:5432/ramola_wms?schema=public" \
  npx prisma db push --schema=prisma/schema.prisma

# Tenant schema (create for armstrong)
# Connect via psql and run:
CREATE SCHEMA tenant_armstrong;

DATABASE_URL="postgresql://ramola:<password>@<rds-endpoint>:5432/ramola_wms?schema=tenant_armstrong" \
  npx prisma db push --schema=prisma/tenant-schema.prisma
```

Then seed:

```sql
-- Public schema
INSERT INTO tenants (id, name, slug, db_schema, status, plan, settings, created_at, updated_at)
VALUES ('tenant-armstrong-1', 'Armstrong Transport', 'armstrong', 'tenant_armstrong', 'active', 'starter', '{}', NOW(), NOW());

INSERT INTO users (id, email, name, password_hash, is_superadmin, created_at, updated_at)
VALUES ('user-admin-1', 'admin@ramola.io', 'Cisco Sanchez', '$2b$12$kIUE/0d4XipK7IOH5xZS2.qUh2lXwIDVAOBdHLpgIoDKfNzSefyLK', true, NOW(), NOW());

INSERT INTO tenant_users (id, user_id, tenant_id, role)
VALUES ('tu-1', 'user-admin-1', 'tenant-armstrong-1', 'admin');
```

#### S3 Bucket

```bash
aws s3 mb s3://ramola-wms-prod --region us-east-1

aws s3api put-bucket-cors --bucket ramola-wms-prod --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://wms.ramola.io", "https://*.wms.ramola.io"],
    "MaxAgeSeconds": 3600
  }]
}'
```

#### ECR + App Runner

```bash
# Create ECR repo
aws ecr create-repository --repository-name ramola-wms

# Build and push
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t ramola-wms .
docker tag ramola-wms:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ramola-wms:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ramola-wms:latest

# Create App Runner service via console:
# - Source: ECR image
# - Port: 3000
# - Auto-scaling: 1-3 instances
# - Health check: /login
```

### 2. Production Environment Variables

```bash
# Database
DATABASE_URL="postgresql://ramola:<password>@<rds-endpoint>:5432/ramola_wms?schema=public"

# Auth — CHANGE THESE
AUTH_SECRET="<generate: openssl rand -base64 48>"
AUTH_URL="https://wms.ramola.io"

# Tenant resolution
TENANT_RESOLUTION="subdomain"   # extracts from armstrong.wms.ramola.io
# OR for header mode (simpler, no wildcard DNS needed):
# TENANT_RESOLUTION="header"
# DEFAULT_TENANT_SLUG="armstrong"

# IMPORTANT: Set false in production
USE_MOCK_DATA="false"
USE_MOCK_AUTH="false"

# S3
S3_ENDPOINT="s3.amazonaws.com"
S3_PORT=443
S3_ACCESS_KEY="AKIA..."
S3_SECRET_KEY="..."
S3_BUCKET="ramola-wms-prod"
S3_USE_SSL=true

# Shopify (when ready)
SHOPIFY_CLIENT_ID="addc43ba314ab95d9ba4b2a1cf406737"
SHOPIFY_CLIENT_SECRET="<from .env>"
SHOPIFY_SHOP_DOMAIN="ramola-dev.myshopify.com"
SHOPIFY_API_VERSION="2026-01"
SHOPIFY_ACCESS_TOKEN="<refresh before deploy>"
```

### 3. DNS Setup

**Option A: Subdomain per tenant** (recommended for multi-tenant)
```
*.wms.ramola.io  →  CNAME → App Runner endpoint
wms.ramola.io    →  ALIAS → App Runner endpoint
```
Set `TENANT_RESOLUTION=subdomain`. The middleware extracts `armstrong` from `armstrong.wms.ramola.io`.

**Option B: Single domain + cookie** (simpler for single tenant)
```
wms.ramola.io → App Runner endpoint
```
Set `TENANT_RESOLUTION=header` and `DEFAULT_TENANT_SLUG=armstrong`. No wildcard DNS needed.

### 4. Pre-Deploy Checklist

- [ ] `USE_MOCK_AUTH=false` — forces real NextAuth login
- [ ] `AUTH_SECRET` is a strong random string (not the dev default)
- [ ] `AUTH_URL` matches the production domain
- [ ] RDS security group allows App Runner's VPC
- [ ] S3 CORS allows the production domain
- [ ] Schema migrations ran against RDS
- [ ] Seed data inserted (tenant, user, tenant_user)
- [ ] Shopify access token refreshed (expires every 24h)
- [ ] Docker image pushed to ECR
- [ ] Login works: `admin@ramola.io` / `admin123`

---

## What's Left to Build

### Priority 1: Wire Real Integrations

| Integration | Status | File | What's needed |
|------------|--------|------|---------------|
| Shopify | Adapter exists, returns mock | `src/lib/integrations/marketplaces/shopify.ts` | Replace mock returns with real REST API calls |
| UPS | Adapter exists, returns mock | `src/lib/integrations/carriers/ups.ts` | Sign up at developer.ups.com, get credentials |
| FedEx | Adapter exists, returns mock | `src/lib/integrations/carriers/fedex.ts` | Sign up at developer.fedex.com, get credentials |
| USPS | Adapter exists, returns mock | `src/lib/integrations/carriers/usps.ts` | Register at usps.com/business/web-tools |

### Priority 2: Armstrong Onboarding

- [ ] Import Armstrong's product catalog (CSV → `tenant_armstrong.products`)
- [ ] Import Armstrong's warehouse layout (→ zones, aisles, racks, shelves, bins)
- [ ] Import Armstrong's client list (→ `tenant_armstrong.clients`)
- [ ] Get NetSuite sandbox credentials for billing integration
- [ ] Get DispatchPro API docs for TMS integration

### Priority 3: Production Hardening

- [ ] Add `htmlFor`/`id` to all form labels (fixes remaining 3 Playwright tests)
- [ ] Email notifications (SendGrid or AWS SES)
- [ ] CI/CD pipeline (GitHub Actions → ECR → App Runner)
- [ ] Error monitoring (Sentry or similar)
- [ ] Log aggregation (CloudWatch)

### Priority 4: Document Intelligence (Separate Repo)

- [ ] Create `ciscosanchez/document-intelligence` repo
- [ ] Follow spec at `docs/docai-handoff.md`
- [ ] Claude Vision API for BOL/packing list OCR

---

## Key Files Reference

| What | Where |
|------|-------|
| Environment config | `.env` |
| Data mode toggle | `USE_MOCK_DATA` in `.env` |
| Auth mode toggle | `USE_MOCK_AUTH` in `.env` |
| Default tenant (dev) | `DEFAULT_TENANT_SLUG` in `.env` |
| Tenant resolution | `src/lib/tenant/context.ts` |
| DB connection (public) | `src/lib/db/public-client.ts` |
| DB connection (tenant) | `src/lib/db/tenant-client.ts` |
| Auth config | `src/lib/auth/auth-options.ts` |
| Auth session helpers | `src/lib/auth/session.ts` |
| Server actions | `src/modules/*/actions.ts` |
| Zod schemas | `src/modules/*/schemas.ts` |
| Prisma schemas | `prisma/schema.prisma` + `prisma/tenant-schema.prisma` |
| Playwright config | `playwright.config.ts` |
| E2E test auth | `tests/e2e/auth.setup.ts` |
| Deployment guide | `docs/deployment.md` |

## Dev Environment Quick Start

```bash
eval "$(fnm env)" && fnm use 22
/Applications/Docker.app/Contents/Resources/bin/docker compose up -d
npm run dev

# Tests
npx jest --passWithNoTests     # 124 unit tests
npx playwright test            # 35 E2E tests (32 stable)

# Login: admin@ramola.io / admin123
```
