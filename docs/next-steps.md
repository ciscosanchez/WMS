# Next Steps — Pick Up Here Tomorrow

*Created: 2026-03-16 end of session*

## Where We Left Off

Everything is built, tested, and pushed to GitHub. The platform has 56 routes, 140 tests, zero lint issues, and a live Shopify connection. The core architecture and UI are complete.

**Current mode:** `USE_MOCK_DATA=true` (mock data rendering). Database is running in Docker with seeded data but pages aren't yet serving from it in the browser.

## Tomorrow's Priority List

### 1. Wire Shopify Real API Calls (2-3 hours)

The Shopify adapter at `src/lib/integrations/marketplaces/shopify.ts` currently returns mock data. The credentials are live and tested:

```
Store: ramola-dev.myshopify.com
Client ID: addc43ba314ab95d9ba4b2a1cf406737
Client Secret: in .env (shpss_...)
Access Token: in .env (shpua_... — expires in 24 hrs, need to refresh)
```

**Tasks:**
- [ ] Implement token refresh (current shpua_ token expires every 24 hours)
- [ ] Replace mock return in `fetchOrders()` with real Shopify REST API call
- [ ] Replace mock return in `syncInventory()` with real inventory_levels/set.json call
- [ ] Replace mock return in `pushFulfillment()` with real fulfillment creation
- [ ] Test: create a test order in Shopify → verify it appears in WMS
- [ ] Test: fulfill an order in WMS → verify tracking appears in Shopify

**Note:** The access token from `client_credentials` grant expires in 24 hours. For production, implement proper OAuth with refresh tokens. For now, re-run this to get a fresh token:
```bash
eval "$(fnm env)" && fnm use 22 && NODE_TLS_REJECT_UNAUTHORIZED=0 node -e "
const https = require('https');
const data = JSON.stringify({
  client_id: 'addc43ba314ab95d9ba4b2a1cf406737',
  client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  grant_type: 'client_credentials'
});
const req = https.request({
  hostname: 'ramola-dev.myshopify.com',
  path: '/admin/oauth/access_token',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(body));
});
req.write(data);
req.end();
"
```

### 2. Sign Up for UPS + FedEx Sandbox (1 hour)

**UPS:**
- [ ] Go to https://developer.ups.com/get-started
- [ ] Sign up → Create app "Ramola WMS" → select Rating + Shipping + Tracking
- [ ] Get Client ID, Client Secret, Account Number
- [ ] Add to .env: `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, `UPS_ACCOUNT_NUMBER`
- [ ] Wire `src/lib/integrations/carriers/ups.ts` — replace mock returns with real UPS REST API calls

**FedEx:**
- [ ] Go to https://developer.fedex.com
- [ ] Sign up → Create project "Ramola WMS" → select Rate + Ship + Track
- [ ] Get Client ID, Client Secret
- [ ] Add to .env: `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET`, `FEDEX_ACCOUNT_NUMBER`
- [ ] Wire `src/lib/integrations/carriers/fedex.ts` — replace mock returns with real FedEx REST API calls

### 3. Flip to Real Database (2-3 hours)

Switch from mock data to real Postgres and fix any pages that break.

**Tasks:**
- [ ] Set `USE_MOCK_DATA=false` and `NEXT_PUBLIC_USE_MOCK_DATA=false` in .env
- [ ] Set browser cookie: `document.cookie = "tenant-slug=armstrong"`
- [ ] Visit every page and verify it renders with DB data:
  - [ ] /dashboard — KPIs from real counts
  - [ ] /clients — Acme, Globex, Initech from DB
  - [ ] /products — 6 SKUs from DB
  - [ ] /warehouse — WH1, WH2 from DB
  - [ ] /receiving — empty (no shipments seeded yet)
  - [ ] /inventory — empty (no inventory seeded yet)
  - [ ] /orders — empty (no orders seeded yet)
- [ ] Seed more data: create shipments, receive them, create orders via the UI
- [ ] Fix any pages that error on empty data (null safety)
- [ ] Test the create flows: New Client → New Product → New Shipment → Receive

### 4. End-to-End Real Flow Test (2-3 hours)

Walk through the complete business flow with real data:

```
1. Create a client (via /clients/new)
2. Create products for that client (via /products/new)
3. Create a warehouse + zones + bins (via /warehouse/new + bulk generate)
4. Create an inbound shipment (via /receiving/new)
5. Add line items to the shipment
6. Mark arrived → Start receiving → Receive items to bins
7. Complete receiving → verify inventory created
8. Create a fulfillment order (via /orders/new)
9. Verify order status flow works (accept → allocate → pick → pack → ship)
10. Check inventory decremented after shipping
11. Verify audit log captured all actions
12. Verify dashboard KPIs reflect the activity
```

### 5. Deploy to AWS (3-4 hours)

**Prerequisites:**
- AWS account with admin access
- Domain name (e.g., wms.ramola.io)

**Tasks:**
- [ ] Create RDS PostgreSQL 16 instance (db.t4g.micro for dev, ~$15/mo)
- [ ] Create S3 bucket for document storage
- [ ] Push Docker image to ECR
- [ ] Deploy via App Runner (simplest) or ECS Fargate
- [ ] Configure Route 53 + ACM certificate for SSL
- [ ] Set environment variables in AWS
- [ ] Run schema migrations against RDS
- [ ] Seed initial data
- [ ] Verify app works on cloud

See `docs/deployment.md` for detailed instructions and cost estimates.

### 6. Email Notifications (2-3 hours)

- [ ] Set up SendGrid or AWS SES
- [ ] Create email templates: shipment received, order shipped, low stock alert
- [ ] Wire notification triggers in server actions
- [ ] Test email delivery

### 7. Get Armstrong Data (Depends on Armstrong)

- [ ] Armstrong's product catalog (CSV/Excel with SKUs, descriptions, weights)
- [ ] Armstrong's warehouse layout (zones, aisles, rack/shelf/bin structure)
- [ ] Armstrong's client list (cargo owners they serve)
- [ ] NetSuite sandbox credentials (for billing integration)
- [ ] DispatchPro API documentation + credentials (for TMS integration)

### 8. Start Document Intelligence Repo

- [ ] Create new repo: `ciscosanchez/document-intelligence`
- [ ] Use handoff doc at `docs/docai-handoff.md` as the spec
- [ ] Start a new Claude session in that directory
- [ ] Tell Claude: "Read `/Users/cisco.sanchez/Sales/armstrong/wms/docs/docai-handoff.md` and `/Users/cisco.sanchez/Sales/armstrong/wms/docs/document-intelligence.md`. Set up the Document Intelligence service."

## Environment Checklist

Before starting tomorrow, verify these are running:

```bash
# 1. Switch to Node 22
eval "$(fnm env)" && fnm use 22 && node -v
# Should show: v22.22.1

# 2. Docker containers running
/Applications/Docker.app/Contents/Resources/bin/docker compose ps
# Should show: postgres (healthy), minio (healthy)

# If not running:
/Applications/Docker.app/Contents/Resources/bin/docker compose up -d

# 3. Dev server
npm run dev
# Should show: Ready on http://localhost:3000

# 4. Verify tests still pass
npx jest --passWithNoTests
# Should show: 124 passed

npx playwright test
# Should show: 16 passed
```

## Key Files to Know

| What | Where |
|------|-------|
| Environment config | `.env` |
| Mock/real toggle | `USE_MOCK_DATA` in `.env` |
| Shopify credentials | `.env` (SHOPIFY_*) |
| Carrier adapters | `src/lib/integrations/carriers/` |
| Marketplace adapters | `src/lib/integrations/marketplaces/` |
| Server actions (business logic) | `src/modules/*/actions.ts` |
| Mock data (when mock mode on) | `src/lib/mock-data/index.ts` |
| Prisma schemas | `prisma/schema.prisma` + `prisma/tenant-schema.prisma` |
| Database seed | `scripts/seed-demo.ts` (or raw SQL via docker exec) |
| Tenant resolution | `src/lib/tenant/context.ts` |
| Auth config | `src/lib/auth/auth-options.ts` |
| All documentation | `docs/` (12 files) |
