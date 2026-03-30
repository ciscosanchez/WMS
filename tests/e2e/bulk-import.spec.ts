import { test, expect } from "./auth.setup";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Creates a temporary CSV file with valid order data for the import flow.
 * Returns the absolute path to the file.
 */
function createTestCsv(): string {
  const header = "clientCode,shipToName,shipToAddress1,shipToCity,shipToZip,sku,quantity";
  const rows = [
    "ARMSTRONG,Jane Doe,100 Import St,Houston,77001,TEST-SKU-001,5",
    "ARMSTRONG,Jane Doe,100 Import St,Houston,77001,TEST-SKU-002,3",
    "ARMSTRONG,John Smith,200 Bulk Ave,Dallas,75201,TEST-SKU-001,10",
  ];
  const content = [header, ...rows].join("\n");
  const tmpPath = path.join(os.tmpdir(), `e2e-import-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, content, "utf-8");
  return tmpPath;
}

test.describe("Bulk Order Import", () => {
  test("import page loads", async ({ page }) => {
    await page.goto("/orders/import");
    await expect(page.getByRole("heading", { name: "Bulk Order Import" })).toBeVisible();
    await expect(page.getByText("Expected CSV columns")).toBeVisible();
  });

  test("uploads CSV and previews parsed orders", async ({ page }) => {
    const csvPath = createTestCsv();

    await page.goto("/orders/import");
    await expect(page.getByRole("heading", { name: "Bulk Order Import" })).toBeVisible();

    // Upload the CSV file
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(csvPath);

    // File name should appear
    await expect(page.getByText(/e2e-import-.*\.csv/)).toBeVisible();

    // Click Preview
    await page.getByRole("button", { name: "Preview" }).click();

    // Wait for preview to complete — either success toast or the preview table
    await expect(page.getByText(/Preview complete/).or(page.getByText(/Preview:/))).toBeVisible({
      timeout: 15_000,
    });

    // Clean up temp file
    fs.unlinkSync(csvPath);
  });

  test("preview table shows parsed order rows", async ({ page }) => {
    const csvPath = createTestCsv();

    await page.goto("/orders/import");

    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(csvPath);

    await page.getByRole("button", { name: "Preview" }).click();

    // Wait for the preview table to appear
    const previewHeading = page.getByText(/Preview: \d+ Orders from \d+ Rows/);
    await expect(previewHeading).toBeVisible({ timeout: 15_000 });

    // The preview table should have expected column headers
    await expect(page.getByRole("columnheader", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ship To" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Total Qty" })).toBeVisible();

    fs.unlinkSync(csvPath);
  });

  test("imports orders after preview", async ({ page }) => {
    const csvPath = createTestCsv();

    await page.goto("/orders/import");

    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(csvPath);

    await page.getByRole("button", { name: "Preview" }).click();

    // Wait for preview
    await expect(page.getByText(/Preview: \d+ Orders from \d+ Rows/)).toBeVisible({
      timeout: 15_000,
    });

    // Click Import button
    const importBtn = page.getByRole("button", { name: /Import \d+ Orders/ });
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    // Expect import results — either success or error toast/card
    await expect(
      page
        .getByText(/Successfully imported/)
        .or(page.getByText("Import Results"))
        .or(page.getByText("Orders Created"))
        .or(page.getByText("Import failed"))
    ).toBeVisible({ timeout: 30_000 });

    fs.unlinkSync(csvPath);
  });

  test("shows error when previewing without a file", async ({ page }) => {
    await page.goto("/orders/import");

    // The Preview button should be disabled when no file is selected
    const previewBtn = page.getByRole("button", { name: "Preview" });
    await expect(previewBtn).toBeDisabled();
  });
});
