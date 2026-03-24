import { test, expect } from "./auth.setup";

test.describe("Operator App — Receive", () => {
  test("loads arrived shipments from DB", async ({ page }) => {
    await page.goto("/receive");
    await expect(page.getByRole("heading", { name: "Receive", exact: true })).toBeVisible();
    // Wait for useEffect data load — both shipments should render
    await expect(page.getByText("ASN-2026-0001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("ASN-2026-0002")).toBeVisible();
    await expect(page.getByText("ARRIVED — READY TO RECEIVE")).toBeVisible();
  });

  test("navigates to shipment detail page", async ({ page }) => {
    await page.goto("/receive");
    // Wait for shipments to load
    await expect(page.getByRole("button", { name: /Start|Continue/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", { name: /Start|Continue/ })
      .first()
      .click();
    await page.waitForURL(/\/receive\/.+/, { timeout: 10_000 });
    await expect(
      page.getByText("Confirm Receive").or(page.getByText("All lines received"))
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shipment detail shows product line cards", async ({ page }) => {
    await page.goto("/receive");
    await expect(page.getByRole("button", { name: /Start|Continue/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", { name: /Start|Continue/ })
      .first()
      .click();
    await page.waitForURL(/\/receive\/.+/, { timeout: 10_000 });
    // Line grid and active line product should appear
    // Product SKU appears in line grid + active card — check via first match
    const sku = page
      .getByText("WIDGET-001")
      .or(page.getByText("GADGET-001"))
      .or(page.getByText("PART-A100"));
    await expect(sku.nth(0)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Operator App — Pick", () => {
  test("loads pick tasks from DB", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByRole("heading", { name: "Pick", exact: true })).toBeVisible();
    await expect(page.getByText("PICK-2026-0001")).toBeVisible({ timeout: 10_000 });
  });

  test("shows KPI cards", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByText("My Active")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
  });

  test("claim button present for pending tasks", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByRole("button", { name: "Claim" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Operator App — Move", () => {
  test("renders the 4-step move form", async ({ page }) => {
    await page.goto("/move");
    await expect(page.getByRole("heading", { name: "Move Inventory", exact: true })).toBeVisible();
    await expect(page.getByText("SCAN SOURCE BIN")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm Move" })).toBeDisabled();
  });
});

test.describe("Operator App — Count", () => {
  test("loads bins with inventory", async ({ page }) => {
    await page.goto("/count");
    await expect(page.getByRole("heading", { name: "Cycle Count", exact: true })).toBeVisible();
    await expect(page.getByText("BINS WITH INVENTORY")).toBeVisible({ timeout: 10_000 });
    // We seeded 4 bins (bin-01..bin-04) — barcode WH1-A-01-01-01-01 etc.
    await expect(page.getByText("WH1-A-01-01-01-01")).toBeVisible({ timeout: 10_000 });
  });

  test("selecting a bin reveals count inputs and submit button", async ({ page }) => {
    await page.goto("/count");
    // Wait for bin list to load then click the first bin card
    await expect(page.getByText("BINS WITH INVENTORY")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.getByText("WH1-A-01-01-01-01").click();
    await expect(page.getByRole("button", { name: "Submit Count" })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole("button", { name: "Empty" })).toBeVisible();
  });
});

test.describe("Operator App — Pack", () => {
  test("renders pack page with empty queue message", async ({ page }) => {
    await page.goto("/pack");
    await expect(page.getByRole("heading", { name: "Pack", exact: true })).toBeVisible();
    // No completed pick tasks seeded — should show empty state
    await expect(
      page.getByText("No tasks ready to pack.").or(page.getByText("READY TO PACK"))
    ).toBeVisible({ timeout: 10_000 });
  });
});
