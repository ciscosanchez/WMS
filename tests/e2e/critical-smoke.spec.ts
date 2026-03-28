import { test, expect } from "./auth.setup";

test.describe("Critical Tenant Smoke", () => {
  test("channels add channel routes to integrations", async ({ page }) => {
    await page.goto("/channels");
    await expect(page.getByRole("heading", { name: "Sales Channels" })).toBeVisible();

    await page.getByRole("button", { name: "Add Channel" }).click();
    await expect(page).toHaveURL(/\/settings\/integrations$/);
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  });

  test("new kit route loads the real form", async ({ page }) => {
    await page.goto("/products/kits/new");

    await expect(page.getByRole("heading", { name: "New Kit" })).toBeVisible();
    await expect(page.getByLabel("Kit Name")).toBeVisible();
    await expect(page.getByLabel("Search Products")).toBeVisible();
  });

  test("new LPN route loads without crashing", async ({ page }) => {
    await page.goto("/inventory/lpn/new");

    await expect(page.getByRole("heading", { name: "New LPN" })).toBeVisible();
    await expect(page.getByLabel("Target Bin")).toBeVisible();
    await expect(page.getByLabel("Pallet Type")).toBeVisible();
  });

  test("workflow rules page fails soft instead of crashing", async ({ page }) => {
    await page.goto("/settings/rules");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /workflow/i })).toBeVisible();
  });

  test("sidebar can collapse and expand without trapping navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const toggle = page.getByRole("button", { name: "Toggle Sidebar" });
    await toggle.click();
    await toggle.click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
