import { test, expect } from "./auth.setup";

test.describe("Receiving Workflow", () => {
  test("creates an inbound shipment", async ({ page }) => {
    await page.goto("/receiving/new");
    await expect(page.getByRole("heading", { name: "New Inbound Shipment" })).toBeVisible();

    // Wait for client dropdown to populate from DB
    const clientSelect = page.locator("select").first();
    await expect(clientSelect).toBeVisible();
    await page.waitForTimeout(2000);

    await clientSelect.selectOption({ index: 1 }); // first real client

    // Labels don't have htmlFor so use input name attribute
    await page.locator("input[name='carrier']").fill("FedEx Freight");
    await page.locator("input[name='trackingNumber']").fill("E2E-TRACK-001");
    await page.locator("input[name='bolNumber']").fill("BOL-E2E-001");

    await page.getByRole("button", { name: "Create Shipment" }).click();

    await expect(page.getByText("Shipment created").or(page.getByText("ASN-"))).toBeVisible({
      timeout: 30_000,
    });
  });

  test("lists shipments from database", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page.getByRole("heading", { name: "Inbound Shipments" })).toBeVisible();
  });
});
