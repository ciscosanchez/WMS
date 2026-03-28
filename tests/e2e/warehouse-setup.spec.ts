import { test, expect } from "./auth.setup";

test.describe("Warehouse Setup Regressions", () => {
  test("warehouse create screen shows structured address fields", async ({ page }) => {
    await page.goto("/warehouse/new");

    await expect(page.getByRole("heading", { name: "New Warehouse" })).toBeVisible();
    await expect(page.getByLabel("Address Line 1")).toBeVisible();
    await expect(page.getByLabel("Address Line 2")).toBeVisible();
    await expect(page.getByLabel("City")).toBeVisible();
    await expect(page.getByLabel("State / Province")).toBeVisible();
    await expect(page.getByLabel("Postal Code")).toBeVisible();
    await expect(page.getByLabel("Country")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Map Preview" })).toBeVisible();
  });

  test("warehouse create cancel returns to warehouse list", async ({ page }) => {
    await page.goto("/warehouse/new");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page).toHaveURL(/\/warehouse$/);
    await expect(page.getByRole("heading", { name: "Warehouse Locations" })).toBeVisible();
  });

  test("manual bin create screen loads and auto-builds barcode from shelf path", async ({
    page,
  }) => {
    await page.goto("/warehouse/bins/new");

    await expect(page.getByRole("heading", { name: "New Bin" })).toBeVisible();
    const shelfSelect = page.getByLabel("Parent Shelf");
    await expect(shelfSelect).toBeVisible();

    const shelfOptions = shelfSelect.locator("option");
    const optionCount = await shelfOptions.count();
    expect(optionCount).toBeGreaterThan(1);

    const firstShelfValue = await shelfOptions.nth(1).getAttribute("value");
    expect(firstShelfValue).toBeTruthy();

    await shelfSelect.selectOption(firstShelfValue!);
    await page.getByLabel("Code").fill("01");

    await expect(page.getByLabel("Barcode")).not.toHaveValue("");
  });

  test("yard spot and dock door create routes render forms", async ({ page }) => {
    await page.goto("/yard-dock/yard-spots/new");
    await expect(page.getByRole("heading", { name: "New Yard Spot" })).toBeVisible();
    await expect(page.getByLabel("Warehouse *")).toBeVisible();

    await page.goto("/yard-dock/dock-doors/new");
    await expect(page.getByRole("heading", { name: "New Dock Door" })).toBeVisible();
    await expect(page.getByLabel("Warehouse *")).toBeVisible();
  });
});
