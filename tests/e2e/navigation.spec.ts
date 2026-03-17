import { test, expect } from "./auth.setup";

test.describe("Navigation", () => {
  test("redirects root to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/dashboard|login/);
  });

  test("dashboard loads with KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Pending Receipts")).toBeVisible();
    await expect(page.getByText("Total SKUs")).toBeVisible();
  });

  test("can navigate to clients page", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  });

  test("can navigate to products page", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  });

  test("can navigate to receiving page", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page.getByRole("heading", { name: "Inbound Shipments" })).toBeVisible();
  });

  test("can navigate to inventory page", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Stock Browser" })).toBeVisible();
  });

  test("can navigate to orders page", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  });

  test("can navigate to picking page", async ({ page }) => {
    await page.goto("/picking");
    await expect(page.getByRole("heading", { name: "Picking" })).toBeVisible();
  });

  test("can navigate to shipping page", async ({ page }) => {
    await page.goto("/shipping");
    await expect(page.getByRole("heading", { name: "Shipping" })).toBeVisible();
  });

  test("can navigate to warehouse page", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.getByRole("heading", { name: "Warehouse Locations" })).toBeVisible();
  });

  test("can navigate to settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("can navigate to reports", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Ramola WMS")).toBeVisible();
  });

  test("portal inventory loads", async ({ page }) => {
    await page.goto("/portal/inventory");
    await expect(page.getByText("My Inventory")).toBeVisible();
  });

  test("operator receive page loads", async ({ page }) => {
    await page.goto("/receive");
    await expect(page.getByRole("heading", { name: "Receive", exact: true })).toBeVisible();
  });

  test("operator pick page loads", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByRole("heading", { name: "Pick" })).toBeVisible();
  });
});
