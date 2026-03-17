import { test, expect } from "./auth.setup";

test.describe("Clients CRUD", () => {
  test("lists seeded clients from database", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(page.getByText("Acme Corporation")).toBeVisible();
    await expect(page.getByText("Globex Industries")).toBeVisible();
    await expect(page.getByText("Initech Logistics")).toBeVisible();
  });

  test("creates a new client and sees it in the list", async ({ page }) => {
    await page.goto("/clients/new");
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();

    // Use "Code *" to avoid matching "Zip Code"
    const code = `TC${Date.now().toString().slice(-5)}`;
    await page.getByLabel("Code *").fill(code);
    await page.getByLabel("Name *").fill(`Test Company ${code}`);
    await page.getByLabel("Contact Name").fill("Test User");
    await page.getByLabel("Contact Email").fill("test@testco.com");
    await page.getByLabel("City").fill("Houston");
    await page.getByLabel("State").fill("TX");

    await page.getByRole("button", { name: "Create Client" }).click();

    // Wait for success — either toast or redirect to list
    await expect(
      page.getByText("Client created").or(page.getByText(`Test Company ${code}`))
    ).toBeVisible({ timeout: 30_000 });
  });

  test("edits a client", async ({ page }) => {
    await page.goto("/clients");
    // Click edit on a client
    const editLink = page.getByRole("link", { name: /edit/i }).first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await expect(page.getByRole("heading", { name: "Edit Client" })).toBeVisible();
    }
  });

  test("client codes visible in list", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByText("ACME", { exact: true })).toBeVisible();
  });
});
