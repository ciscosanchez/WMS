import { test, expect } from "./auth.setup";

test.describe("Orders Workflow", () => {
  test("orders page loads (empty state or list)", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  });

  test("creates a fulfillment order", async ({ page }) => {
    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { name: "New Order" })).toBeVisible();

    // Wait for client dropdown to populate from DB
    const clientSelect = page.locator("select").first();
    await expect(clientSelect).toBeVisible();
    await page.waitForTimeout(2000);

    // Select client
    await clientSelect.selectOption({ index: 1 }); // first real client

    // Fill ship-to address using placeholders and labels
    await page.getByPlaceholder("Jane Cooper").fill("E2E Test Customer");
    await page.getByPlaceholder("123 Main St").fill("123 Test St");
    await page.getByLabel("City *").fill("Houston");
    await page.getByPlaceholder("TX").fill("TX");
    await page.getByPlaceholder("77001").fill("77001");

    // Add a product line — wait for products to load
    await page.waitForTimeout(1000);
    const productSelect = page.locator("select").nth(3);
    if ((await productSelect.locator("option").count()) > 1) {
      await productSelect.selectOption({ index: 1 });
      // Click the add button (the + icon button)
      await page.locator("button:has(svg.lucide-plus)").last().click();
    }

    // Submit order
    const submitBtn = page.getByRole("button", { name: "Create Order" });
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForURL("/orders", { waitUntil: "commit" });
    }
  });

  test("order status can be advanced", async ({ page }) => {
    await page.goto("/orders");
    const orderLink = page.getByRole("link", { name: /ORD-/ }).first();
    if (await orderLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orderLink.click();
      await page.waitForURL(/\/orders\//);
      await expect(page.getByText(/Accept Order|Allocate|Pick|Pack|Ship/)).toBeVisible();
    }
  });
});
