import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("redirects root to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/dashboard");
  });

  test("dashboard loads with KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=Pending Receipts")).toBeVisible();
    await expect(page.locator("text=Total SKUs")).toBeVisible();
  });

  test("can navigate to clients page", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.locator("text=Clients")).toBeVisible();
    await expect(page.locator("text=ACME")).toBeVisible();
  });

  test("can navigate to products page", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("text=Products")).toBeVisible();
    await expect(page.locator("text=WIDGET-001")).toBeVisible();
  });

  test("can navigate to receiving page", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page.locator("text=Inbound Shipments")).toBeVisible();
    await expect(page.locator("text=ASN-2026-0001")).toBeVisible();
  });

  test("can navigate to inventory page", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.locator("text=Stock Browser")).toBeVisible();
  });

  test("can navigate to orders page", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("text=Orders")).toBeVisible();
    await expect(page.locator("text=ORD-2026-0001")).toBeVisible();
  });

  test("can navigate to picking page", async ({ page }) => {
    await page.goto("/picking");
    await expect(page.locator("text=Picking")).toBeVisible();
  });

  test("can navigate to shipping page", async ({ page }) => {
    await page.goto("/shipping");
    await expect(page.locator("text=Shipping")).toBeVisible();
  });

  test("can navigate to warehouse page", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.locator("text=Warehouse Locations")).toBeVisible();
    await expect(page.locator("text=Main Warehouse")).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.click("text=Clients");
    await expect(page).toHaveURL("/clients");
    await page.click("text=Orders");
    await expect(page).toHaveURL("/orders");
  });
});
