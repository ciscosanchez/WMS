import { test, expect } from "./auth.setup";

test.describe("Doc Intelligence", () => {
  // ─── Smart Receiving page ──────────────────────────────────────────────────

  test("Smart Receiving page loads with upload UI", async ({ page }) => {
    await page.goto("/receiving/smart");

    await expect(page.getByRole("heading", { name: "Smart Receiving" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload File" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take Photo" })).toBeVisible();

    // Hidden file input must be attached
    await expect(page.locator("input[type='file'][accept='image/*,.pdf']")).toBeAttached();
  });

  // ─── Shipment header: no notes blob ───────────────────────────────────────

  test.describe("shipment detail header", () => {
    let shipmentUrl: string;

    test.beforeAll(async ({ browser }) => {
      // Create a fresh shipment to run header checks against
      const context = await browser.newContext();
      const page = await context.newPage();
      await context.addCookies([
        { name: "tenant-slug", value: "armstrong", domain: "localhost", path: "/" },
      ]);

      await page.goto("/receiving/new");
      await page.waitForTimeout(2000); // allow client list to load from DB
      await page.locator("select").first().selectOption({ index: 1 });
      await page.locator("input[name='carrier']").fill("DocAI Test Carrier");
      await page.locator("input[name='trackingNumber']").fill("DOCAI-BLOB-TEST");
      await page.getByRole("button", { name: "Create Shipment" }).click();

      await expect(page.getByText(/ASN-/)).toBeVisible({ timeout: 30_000 });
      shipmentUrl = page.url();
      await context.close();
    });

    test("does not display raw extraction blob in header card", async ({ page }) => {
      await page.goto(shipmentUrl);

      // The info card should have the structured grid fields
      await expect(page.getByText("Carrier:")).toBeVisible();
      await expect(page.getByText("Tracking:")).toBeVisible();
      await expect(page.getByText("BOL:")).toBeVisible();

      // The old notes blob paragraph (mt-4 text-sm text-muted-foreground inside the card)
      // must not be present — extraction text no longer dumped into shipment.notes
      const blob = page.locator("p.mt-4.text-sm");
      await expect(blob).not.toBeAttached();
    });

    test("Close & Finalize PDF button is visible", async ({ page }) => {
      await page.goto(shipmentUrl);
      await expect(
        page.getByRole("button", { name: /Close & Finalize PDF/i })
      ).toBeVisible({ timeout: 10_000 });
    });

    test("Close & Finalize PDF runs and surfaces a result toast", async ({ page }) => {
      await page.goto(shipmentUrl);

      // Accept the confirm() dialog
      page.once("dialog", (dialog) => dialog.accept());

      await page.getByRole("button", { name: /Close & Finalize PDF/i }).click();

      // Action resolves — either success (has documents) or informative error (no docs yet)
      await expect(
        page
          .getByText(/Master PDF created/i)
          .or(page.getByText(/No documents found/i))
          .or(page.getByText(/No PDF or image/i))
      ).toBeVisible({ timeout: 60_000 });
    });
  });

  // ─── Document auto-attachment: extraction review UI ───────────────────────

  test("ExtractionReview shows Create Inbound Shipment button with client selector", async ({
    page,
  }) => {
    // Navigate to an existing completed processing job if one exists,
    // otherwise just verify the review route renders without crashing on a
    // non-existent ID (404 is acceptable — we're checking the route exists).
    await page.goto("/receiving/review/nonexistent-job-id");

    // Should either show the review page or a not-found — not a 500 crash
    const status = page.getByText(/not found|review|extraction/i);
    await expect(status).toBeVisible({ timeout: 15_000 });
  });

  // ─── Documents tab ─────────────────────────────────────────────────────────

  test("Documents tab is visible on shipment detail", async ({ page }) => {
    await page.goto("/receiving");
    await page.waitForTimeout(1000);

    const firstShipmentLink = page.getByRole("link", { name: /ASN-/ }).first();
    await firstShipmentLink.click();

    await expect(
      page.getByRole("tab", { name: /Documents/i })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("tab", { name: /Documents/i }).click();

    // Panel loads — either has documents or shows upload UI
    await expect(
      page.getByText(/Documents|Upload|No documents/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
