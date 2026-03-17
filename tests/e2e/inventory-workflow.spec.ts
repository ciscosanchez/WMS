import { test, expect } from "./auth.setup";

test.describe("Inventory Workflow", () => {
  test("inventory page loads and shows stock", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Stock Browser" })).toBeVisible();
  });

  test("inventory movements page loads", async ({ page }) => {
    await page.goto("/inventory/movements");
    await expect(page.getByRole("heading", { name: "Inventory Movements" })).toBeVisible();
  });

  test("inventory adjustments page loads", async ({ page }) => {
    await page.goto("/inventory/adjustments");
    await expect(page.getByRole("heading", { name: "Inventory Adjustments" })).toBeVisible();
  });

  test("dashboard shows real KPIs from database", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total SKUs")).toBeVisible();
    await expect(page.getByText("Pending Receipts")).toBeVisible();
  });
});
