# Armstrong Feature Requests — Scope & Status

Source: Armstrong operator feedback, March 20 2026

## Summary

| # | Request | Owner | Status | Route/Location |
|---|---------|-------|--------|----------------|
| 9 | Operator daily dashboard & task visibility | WMS | **Live** | `/my-tasks` (operator), `/operations` (manager) |
| 3a | Scan-out / release verification | WMS | **Live** | Pick screen + Product schema |
| 7 | Movement tracking & pick path optimization | WMS | In progress | — |
| 3b | TMS rate comparison | DispatchPro | Not started | — |
| 5 | Email→NetSuite quote automation | Out of scope | — | NetSuite customization |

---

## WMS Features (this repo)

### #9 — Operator Daily Dashboard ✅ Shipped

**Problem:** Warehouse workers manage reactively. No forward visibility into assigned work. Managers can't see operator workload until end of day/week.

**What was built:**
- **Operator view** (`/my-tasks`): "My Tasks Today" grouped by type (picking, receiving, counts). Each task shows progress (e.g., 3/5 lines), priority badge, tap-to-navigate. Completed tasks shown at bottom.
- **Manager board** (`/operations`): KPIs (completed today, avg time, pending, active receiving), unassigned task list with assign-to-operator dropdown, operator workload cards with progress bars.

**Files:**
- `src/modules/dashboard/operator-actions.ts`
- `src/modules/dashboard/manager-actions.ts`
- `src/app/(operator)/my-tasks/page.tsx`
- `src/app/(tenant)/operations/page.tsx`
- `src/app/(tenant)/operations/assign-task-button.tsx`

---

### #3a — Scan-Out / Release Verification ✅ Shipped

**Problem:** Unfamiliar operators can't tell if a pick request means carton count or unit count. No product-level scan verification on pick — only bin verification.

**What was built:**
- **Product scan on pick**: Pick screen now accepts product barcode OR SKU scan (not just bin barcode) as verification
- **Units-per-case display**: When `unitsPerCase` is set on a product, pick screen shows "Pick N EACH" with a warning: "X units per case — pick individual units, NOT cartons"
- **Schema**: Added `units_per_case` and `case_barcode` columns to products table
- **Pack screen**: Already had item-by-item barcode scan verification (no changes needed)

**Files:**
- `src/app/(operator)/pick/page.tsx` — enhanced scan + display
- `prisma/tenant-schema.prisma` — Product model: `unitsPerCase`, `caseBarcode`
- `prisma/tenant-migrations/0003_product_packaging.sql`

**To configure:** Set `units_per_case` on products where carton/unit confusion exists (e.g., if SKU HW-GLOVE-002 ships 12 per case, set `units_per_case = 12`).

---

### #7 — Movement Tracking & Pick Path Optimization 🔧 In Progress

**Problem:** Operators pick a pallet, go to the dock, then bring another pallet back to the same location. No routing guidance. No visibility into wasted movement.

**What needs to be built:**
- **Pick path sorting**: Sort pick task lines by bin location (zone → aisle → rack → shelf) to minimize travel. Bin codes already encode location: `DAL-01-A-01-02-03`.
- **Putaway suggestions**: When receiving, suggest a bin near existing inventory of the same product.
- **Movement analytics**: Report showing operator travel patterns (from/to bins per transaction) to identify inefficiency.

---

## DispatchPro Features (separate repo)

### #3b — TMS Rate Comparison

**Problem:** Armstrong wants to compare their current brokered freight cost ("team that layers cost on top") against market rates.

**What needs to be built:**
- Rate card model in DispatchPro
- Carrier rate API integrations
- Comparison UI: actual cost vs. market rate per shipment

**Open question:** Is Armstrong asking about FTL/LTL rate shopping, managing their own fleet vs. brokered, or auditing broker markups? Clarify before building.

---

## Out of Scope

### #5 — Email→NetSuite Quote Automation

**Problem:** Armstrong receives most quotes via email. They want an email reader (like Copilot) that skims emails and suggests business line and product class for NetSuite quotes. They have an Outlook→NetSuite email sync but the autofill isn't working.

**Why out of scope:** This is a NetSuite SuiteScript / CRM customization problem, not a warehouse feature. The WMS operates downstream of quoting.

**If Ramola wants to help:** This could be a consulting engagement or a separate product — email intelligence using Claude API for entity extraction from quote emails. Similar architecture to DocAI (separate service, API-based).
