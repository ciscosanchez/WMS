/**
 * Warehouse-level RBAC E2E tests.
 *
 * Prerequisites: run `npm run db:seed:e2e` to create the armstrong tenant
 * with stable warehouse IDs (wh-e2e-memphis, wh-e2e-arkansas).
 */
import { E2E_WAREHOUSE_MEMPHIS, E2E_WAREHOUSE_ARKANSAS } from "./e2e-constants";
import { test, expect } from "./auth.setup";

// ─── Scenario 1: Admin sees all warehouses ────────────────────────────────────

test("admin sees all warehouses in list", async ({ page, signInAs }) => {
  await signInAs("admin");
  await page.goto("/warehouse");

  // Both seeded warehouses should appear
  await expect(page.getByText("Memphis Distribution Center")).toBeVisible();
  await expect(page.getByText("Arkansas Fulfillment Center")).toBeVisible();
});

// ─── Scenario 2: Unrestricted manager sees all warehouses ─────────────────────

test("manager with no warehouse assignments sees all warehouses", async ({ page, signInAs }) => {
  await signInAs("manager");
  await page.goto("/warehouse");

  await expect(page.getByText("Memphis Distribution Center")).toBeVisible();
  await expect(page.getByText("Arkansas Fulfillment Center")).toBeVisible();
});

// ─── Scenario 3: Location-restricted manager sees only assigned warehouse ─────

test("location_manager sees only Memphis in warehouse list", async ({ page, signInAs }) => {
  await signInAs("location_manager");
  await page.goto("/warehouse");

  await expect(page.getByText("Memphis Distribution Center")).toBeVisible();
  await expect(page.getByText("Arkansas Fulfillment Center")).not.toBeVisible();
});

// ─── Scenario 4: Location manager can navigate to their assigned warehouse ────

test("location_manager can open the Memphis warehouse detail page", async ({ page, signInAs }) => {
  await signInAs("location_manager");
  await page.goto(`/warehouse/${E2E_WAREHOUSE_MEMPHIS}`);

  // Page should load successfully — warehouse name visible
  await expect(page.getByText("Memphis Distribution Center")).toBeVisible();
});

// ─── Scenario 5: Location manager blocked from unassigned warehouse ───────────

test("location_manager cannot access Arkansas warehouse detail page", async ({
  page,
  signInAs,
}) => {
  await signInAs("location_manager");
  await page.goto(`/warehouse/${E2E_WAREHOUSE_ARKANSAS}`);

  // Should land on an error or be redirected — warehouse content must NOT appear
  await expect(page.getByText("Arkansas Fulfillment Center")).not.toBeVisible();
});
