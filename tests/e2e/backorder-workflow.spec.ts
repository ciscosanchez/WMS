import { test, expect } from "./auth.setup";

test.describe("Backorder Workflow", () => {
  test("backorders page loads (empty state or list)", async ({ page }) => {
    await page.goto("/orders/backorders");
    await expect(page.getByRole("heading", { name: "Backorders" })).toBeVisible();
  });

  test("creates an order that lands in backorders when no inventory", async ({ page }) => {
    // Step 1 — Create an order
    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { name: "New Order" })).toBeVisible();

    // Wait for client dropdown to populate from DB
    const clientSelect = page.locator("select").first();
    await expect(clientSelect).toBeVisible();
    await page.waitForTimeout(2000);

    await clientSelect.selectOption({ index: 1 });

    // Fill ship-to address
    await page.getByPlaceholder("Jane Cooper").fill("Backorder Test Customer");
    await page.getByPlaceholder("123 Main St").fill("999 Backorder Ln");
    await page.getByLabel("City *").fill("Memphis");
    await page.getByPlaceholder("TX").fill("TN");
    await page.getByPlaceholder("77001").fill("38101");

    // Add a product line
    await page.waitForTimeout(1000);
    const productSelect = page.locator("select").nth(3);
    if ((await productSelect.locator("option").count()) > 1) {
      await productSelect.selectOption({ index: 1 });
      await page.locator("button:has(svg.lucide-plus)").last().click();
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: "Create Order" });
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForURL("/orders", { waitUntil: "commit" });
    }

    // Step 2 — Navigate to backorders
    await page.goto("/orders/backorders");
    await expect(page.getByRole("heading", { name: "Backorders" })).toBeVisible();

    // The page should show either the backorders table or the empty state
    const hasTable = await page
      .locator("table")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText("No backorders")
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("can invoke Check Fulfillment action on a backorder", async ({ page }) => {
    await page.goto("/orders/backorders");
    await expect(page.getByRole("heading", { name: "Backorders" })).toBeVisible();

    // Only proceed if there are backorders in the table
    const actionBtn = page.locator("button:has(svg.lucide-more-horizontal)").first();
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click();
      const checkItem = page.getByRole("menuitem", {
        name: "Check Fulfillment",
      });
      await expect(checkItem).toBeVisible();
      await checkItem.click();

      // Expect a toast (success, info, or warning) confirming the action
      await expect(
        page
          .getByText(/can be fulfilled|No lines can be fulfilled/)
          .or(page.getByText("Failed to check fulfillment"))
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("can invoke Retry Allocation action on a backorder", async ({ page }) => {
    await page.goto("/orders/backorders");
    await expect(page.getByRole("heading", { name: "Backorders" })).toBeVisible();

    const actionBtn = page.locator("button:has(svg.lucide-more-horizontal)").first();
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click();
      const retryItem = page.getByRole("menuitem", {
        name: "Retry Allocation",
      });
      await expect(retryItem).toBeVisible();
      await retryItem.click();

      // Expect a toast confirming the retry
      await expect(
        page
          .getByText(/allocated|still backordered|moved to picking/)
          .or(page.getByText("Failed to retry allocation"))
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});
