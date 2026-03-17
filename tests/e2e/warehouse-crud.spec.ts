import { test, expect } from "./auth.setup";

test.describe("Warehouse CRUD", () => {
  test("lists seeded warehouses from database", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.getByRole("heading", { name: "Warehouse Locations" })).toBeVisible();
    // Wait for data to load (page may show skeleton first)
    await expect(page.getByText("Main Warehouse").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Cold Storage Annex").first()).toBeVisible();
  });

  test("creates a new warehouse", async ({ page }) => {
    await page.goto("/warehouse/new");
    await expect(page.getByRole("heading", { name: "New Warehouse" })).toBeVisible();

    const code = `WH${Date.now().toString().slice(-4)}`;
    await page.getByLabel("Code *").fill(code);
    await page.getByLabel("Name *").fill(`E2E Warehouse ${code}`);

    await page.getByRole("button", { name: /Create/i }).click();

    // Wait for success toast or redirect
    await expect(
      page.getByText("Warehouse created").or(page.getByText(`E2E Warehouse ${code}`))
    ).toBeVisible({ timeout: 30_000 });
  });

  test("opens warehouse detail", async ({ page }) => {
    await page.goto("/warehouse");
    // Wait for content to load
    await expect(page.getByText("Main Warehouse").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Main Warehouse").first().click();
    await page.waitForURL(/\/warehouse\//);
    // Wait for detail to load
    await expect(page.getByText("Main Warehouse")).toBeVisible({ timeout: 15_000 });
  });
});
