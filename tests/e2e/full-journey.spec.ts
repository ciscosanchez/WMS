import { test, expect } from "./auth.setup";

/**
 * Full WMS journey: Create client -> Create product ->
 * Create inbound shipment
 */
test.describe("Full WMS Journey", () => {
  const uniqueId = Date.now().toString().slice(-6);

  test("end-to-end: client -> product -> shipment", async ({ page }) => {
    // Step 1: Create a new client
    await page.goto("/clients/new");
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
    await page.getByLabel("Code *").fill(`J${uniqueId}`);
    await page.getByLabel("Name *").fill(`Journey Client ${uniqueId}`);
    await page.getByRole("button", { name: "Create Client" }).click();
    await expect(
      page.getByText("Client created").or(page.getByText(`Journey Client ${uniqueId}`))
    ).toBeVisible({ timeout: 30_000 });

    // Step 2: Create a product for that client
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "New Product" })).toBeVisible();
    const clientSelect = page.locator("select#clientId");
    await expect(clientSelect).toBeVisible();
    await page.waitForTimeout(2000);
    // Find the option that contains our unique client
    const options = clientSelect.locator("option");
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text?.includes(`J${uniqueId}`)) {
        await clientSelect.selectOption({ index: i });
        break;
      }
    }
    await page.getByLabel("SKU *").fill(`SKU-${uniqueId}`);
    await page.getByLabel("Name *").fill(`Journey Product ${uniqueId}`);
    await page.getByLabel("Base UOM").fill("EA");
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(
      page.getByText("Product created").or(page.getByText(`SKU-${uniqueId}`))
    ).toBeVisible({ timeout: 30_000 });

    // Step 3: Create an inbound shipment
    await page.goto("/receiving/new");
    await expect(page.getByRole("heading", { name: "New Inbound Shipment" })).toBeVisible();
    const shipmentClientSelect = page.locator("select").first();
    await page.waitForTimeout(2000);
    const shipOpts = shipmentClientSelect.locator("option");
    const shipOptCount = await shipOpts.count();
    for (let i = 0; i < shipOptCount; i++) {
      const text = await shipOpts.nth(i).textContent();
      if (text?.includes(`J${uniqueId}`)) {
        await shipmentClientSelect.selectOption({ index: i });
        break;
      }
    }
    await page.getByLabel("Carrier").fill("E2E Carrier");
    await page.getByLabel("BOL Number").fill(`BOL-${uniqueId}`);
    await page.getByRole("button", { name: "Create Shipment" }).click();
    await expect(page.getByText("Shipment created").or(page.getByText("ASN-"))).toBeVisible({
      timeout: 30_000,
    });

    // Step 4: Dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
