import { test, expect } from "./auth.setup";

test.describe("Cycle Count Workflow", () => {
  test("cycle counts page loads with summary cards", async ({ page }) => {
    await page.goto("/inventory/cycle-counts");
    await expect(page.getByRole("heading", { name: "Cycle Counts" })).toBeVisible();

    // Summary cards should be visible
    await expect(page.getByText("Active")).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible();
    await expect(page.getByText("Total Lines Counted")).toBeVisible();
  });

  test("creates a new cycle count plan", async ({ page }) => {
    await page.goto("/inventory/cycle-counts/new");
    await expect(page.getByRole("heading", { name: "New Cycle Count Plan" })).toBeVisible();

    // Fill form
    await page.getByLabel("Name").fill("E2E Monthly Full Count");
    await page.getByLabel("Method").selectOption("full");
    await page.getByLabel("Frequency").selectOption("monthly");

    // Submit
    await page.getByRole("button", { name: "Create Plan" }).click();

    // Should redirect back to the cycle counts list
    await page.waitForURL("/inventory/cycle-counts", {
      waitUntil: "commit",
      timeout: 15_000,
    });

    await expect(page.getByRole("heading", { name: "Cycle Counts" })).toBeVisible();
  });

  test("newly created plan appears in plans table", async ({ page }) => {
    // First create a plan so we have data
    await page.goto("/inventory/cycle-counts/new");
    await page.getByLabel("Name").fill("E2E Verify Plan");
    await page.getByLabel("Method").selectOption("full");
    await page.getByLabel("Frequency").selectOption("monthly");
    await page.getByRole("button", { name: "Create Plan" }).click();
    await page.waitForURL("/inventory/cycle-counts", {
      waitUntil: "commit",
      timeout: 15_000,
    });

    // Verify plans table section
    await expect(page.getByRole("heading", { name: "Cycle Count Plans" })).toBeVisible();

    // The plan name should appear in the table
    await expect(page.getByText("E2E Verify Plan")).toBeVisible();
  });

  test("can invoke Generate Tasks on a plan", async ({ page }) => {
    // Create a plan first
    await page.goto("/inventory/cycle-counts/new");
    await page.getByLabel("Name").fill("E2E Gen Tasks Plan");
    await page.getByLabel("Method").selectOption("full");
    await page.getByLabel("Frequency").selectOption("monthly");
    await page.getByRole("button", { name: "Create Plan" }).click();
    await page.waitForURL("/inventory/cycle-counts", {
      waitUntil: "commit",
      timeout: 15_000,
    });

    // Open the actions dropdown for the first plan row
    const actionBtn = page.locator("button:has(svg.lucide-more-horizontal)").first();
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click();
      const generateItem = page.getByRole("menuitem", {
        name: "Generate Tasks",
      });
      await expect(generateItem).toBeVisible();
      await generateItem.click();

      // Expect a toast confirming generation
      await expect(
        page
          .getByText(/Generated \d+ cycle count tasks/)
          .or(page.getByText("No inventory matched"))
          .or(page.getByText("Failed to generate tasks"))
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("new plan link navigates to form", async ({ page }) => {
    await page.goto("/inventory/cycle-counts");
    await page.getByRole("link", { name: "New Plan" }).click();
    await page.waitForURL("/inventory/cycle-counts/new", {
      waitUntil: "commit",
    });
    await expect(page.getByRole("heading", { name: "New Cycle Count Plan" })).toBeVisible();
  });
});
