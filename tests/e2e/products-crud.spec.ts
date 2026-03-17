import { test, expect } from "./auth.setup";

test.describe("Products CRUD", () => {
  test("lists seeded products from database", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByText("WIDGET-001").first()).toBeVisible();
    await expect(page.getByText("GADGET-001").first()).toBeVisible();
    await expect(page.getByText("BOLT-M8X40").first()).toBeVisible();
  });

  test("creates a new product", async ({ page }) => {
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "New Product" })).toBeVisible();

    // Wait for client dropdown to populate from DB
    const clientSelect = page.locator("select#clientId");
    await expect(clientSelect).toBeVisible();
    await page.waitForTimeout(2000); // let options populate

    await clientSelect.selectOption({ index: 1 }); // first real client
    const sku = `E2E-${Date.now().toString().slice(-6)}`;
    await page.getByLabel("SKU *").fill(sku);
    await page.getByLabel("Name *").fill(`E2E Product ${sku}`);
    await page.getByLabel("Base UOM").fill("EA");

    await page.getByRole("button", { name: "Create Product" }).click();

    await expect(page.getByText("Product created").or(page.getByText(sku))).toBeVisible({
      timeout: 30_000,
    });
  });
});
