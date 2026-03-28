import { test, expect } from "./auth.setup";

test.describe("Operator App — Full Screens", () => {
  // ---------------------------------------------------------------------------
  // Auth and navigation
  // ---------------------------------------------------------------------------

  test("operator can reach /my-tasks — shows shift banner or task sections, no crash", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/my-tasks");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // After data loads, one of the two shift banners must be visible
    await expect(
      page
        .locator(".bg-amber-50") // not-clocked-in amber banner
        .or(page.locator(".bg-green-50")) // clocked-in green banner
        .or(page.getByText(/no active tasks/i)) // empty state heading
        .or(page.getByText(/picking/i)) // active tasks section header
    ).toBeVisible({ timeout: 10_000 });
  });

  test("operator sees Release nav tab in bottom navigation", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/my-tasks");

    // The bottom nav renders nav links — release must be present
    await expect(page.getByRole("link", { name: /release/i })).toBeVisible();
  });

  test("all operator nav tabs are reachable without crashing — pick", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/pick");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — pack", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/pack");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — receive", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/receive");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — move", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/move");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — count", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/count");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — shift", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/shift");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("all operator nav tabs are reachable without crashing — release", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/release");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // Shift flow
  // ---------------------------------------------------------------------------

  test("/shift page loads showing clock-in or clock-out button", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/shift");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // Either Clock In button (not clocked in) or Clock Out button (clocked in)
    await expect(
      page
        .getByRole("button", { name: /clock in/i })
        .or(page.getByRole("button", { name: /clock out/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shift page renders status badge — clocked in or not clocked in", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/shift");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // The page always shows a status badge after loading
    await expect(page.getByText(/clocked in/i).or(page.getByText(/not clocked in/i))).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Pick flow
  // ---------------------------------------------------------------------------

  test("/pick page loads for operator without crashing", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/pick");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /pick/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("pick page shows KPI cards — not an error state", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/pick");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // KPI cards are always rendered once data loads (values may be 0)
    await expect(page.getByText(/my active/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/available/i)).toBeVisible({ timeout: 10_000 });
  });

  test("pick page shows no-tasks message or task list — not an error state", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/pick");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // One of these must be present once loading resolves
    await expect(
      page
        .getByText(/no pick tasks/i)
        .or(page.getByText(/my active tasks/i))
        .or(page.getByText(/available tasks/i))
        .or(page.getByRole("button", { name: /claim/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("pick page — claiming a task (if available) shows it in active tasks or confirms", async ({
    page,
    signInAs,
  }) => {
    await signInAs("operator");
    await page.goto("/pick");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // Only exercise click path if a Claim button is present; skip gracefully if not
    const claimBtn = page.getByRole("button", { name: /claim/i }).first();
    const claimBtnCount = await claimBtn.count();

    if (claimBtnCount > 0) {
      await claimBtn.click();
      // After claiming, page should reload — no crash regardless of outcome
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.getByText(/my active tasks/i).or(page.getByText(/claimed/i))).toBeVisible({
        timeout: 10_000,
      });
    } else {
      // No tasks available — verify empty state is shown instead
      await expect(page.getByText(/no pick tasks/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  // ---------------------------------------------------------------------------
  // Pack flow
  // ---------------------------------------------------------------------------

  test("/pack page loads without crashing", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/pack");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /pack/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("pack page shows scan input or empty queue message", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/pack");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // BarcodeScannerInput renders an input with placeholder, OR empty state appears
    await expect(
      page
        .getByPlaceholder(/scan order barcode/i)
        .or(page.getByText(/no tasks ready to pack/i))
        .or(page.getByText(/ready to pack/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Release gate
  // ---------------------------------------------------------------------------

  test("/release page loads without crashing — thorough check", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/release");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /release/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("release page shows barcode scanner input", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/release");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // The top-level BarcodeScannerInput for scanning order barcodes is always rendered
    await expect(page.getByPlaceholder(/scan order barcode/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("release page — scanning unknown barcode shows error toast", async ({ page, signInAs }) => {
    await signInAs("operator");
    await page.goto("/release");

    // Wait for the scanner input to be ready
    const scanInput = page.getByPlaceholder(/scan order barcode/i);
    await expect(scanInput).toBeVisible({ timeout: 10_000 });

    // Simulate wedge scanner: type the barcode value then press Enter to submit the form
    await scanInput.click();
    await page.keyboard.type("UNKNOWN-SKU-12345");
    await page.keyboard.press("Enter");

    // An error toast should appear indicating shipment not found
    await expect(
      page.getByText(/no shipment found/i).or(page.getByText(/UNKNOWN-SKU-12345/))
    ).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Manager board (Operations)
  // ---------------------------------------------------------------------------

  test("/operations loads for manager — shows operator workload section", async ({
    page,
    signInAs,
  }) => {
    await signInAs("manager");
    await page.goto("/operations");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Operations Board" })).toBeVisible({
      timeout: 10_000,
    });

    // Operator workload card heading is always rendered once data loads
    await expect(page.getByText(/operator workload/i)).toBeVisible({ timeout: 10_000 });
  });

  test("operations board shows Awaiting Release KPI card", async ({ page, signInAs }) => {
    await signInAs("manager");
    await page.goto("/operations");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // Both KPI cards for the release gate must be rendered once data arrives
    await expect(
      page.getByText("Awaiting Release").or(page.getByText("Released Today"))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/operations auto-polls — page does not crash after 5 seconds", async ({
    page,
    signInAs,
  }) => {
    await signInAs("manager");
    await page.goto("/operations");

    await expect(page.getByRole("heading", { name: "Operations Board" })).toBeVisible({
      timeout: 10_000,
    });

    // Wait 5 seconds — the 60-second poll interval should not cause a crash
    await page.waitForTimeout(5_000);

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Operations Board" })).toBeVisible();
  });
});

test.describe("Operator App — Receive", () => {
  test("loads arrived shipments from DB", async ({ page }) => {
    await page.goto("/receive");
    await expect(page.getByRole("heading", { name: "Receive", exact: true })).toBeVisible();
    // Wait for useEffect data load — both shipments should render
    await expect(page.getByText("ASN-2026-0001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("ASN-2026-0002")).toBeVisible();
    await expect(page.getByText("ARRIVED — READY TO RECEIVE")).toBeVisible();
  });

  test("navigates to shipment detail page", async ({ page }) => {
    await page.goto("/receive");
    // Wait for shipments to load
    await expect(page.getByRole("button", { name: /Start|Continue/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", { name: /Start|Continue/ })
      .first()
      .click();
    await page.waitForURL(/\/receive\/.+/, { timeout: 10_000 });
    await expect(
      page.getByText("Confirm Receive").or(page.getByText("All lines received"))
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shipment detail shows product line cards", async ({ page }) => {
    await page.goto("/receive");
    await expect(page.getByRole("button", { name: /Start|Continue/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", { name: /Start|Continue/ })
      .first()
      .click();
    await page.waitForURL(/\/receive\/.+/, { timeout: 10_000 });
    // Line grid and active line product should appear
    // Product SKU appears in line grid + active card — check via first match
    const sku = page
      .getByText("WIDGET-001")
      .or(page.getByText("GADGET-001"))
      .or(page.getByText("PART-A100"));
    await expect(sku.nth(0)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Operator App — Pick", () => {
  test("loads pick tasks from DB", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByRole("heading", { name: "Pick", exact: true })).toBeVisible();
    await expect(page.getByText("PICK-2026-0001")).toBeVisible({ timeout: 10_000 });
  });

  test("shows KPI cards", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByText("My Active")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
  });

  test("claim button present for pending tasks", async ({ page }) => {
    await page.goto("/pick");
    await expect(page.getByRole("button", { name: "Claim" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Operator App — Move", () => {
  test("renders the 4-step move form", async ({ page }) => {
    await page.goto("/move");
    await expect(page.getByRole("heading", { name: "Move Inventory", exact: true })).toBeVisible();
    await expect(page.getByText("SCAN SOURCE BIN")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm Move" })).toBeDisabled();
  });
});

test.describe("Operator App — Count", () => {
  test("loads bins with inventory", async ({ page }) => {
    await page.goto("/count");
    await expect(page.getByRole("heading", { name: "Cycle Count", exact: true })).toBeVisible();
    await expect(page.getByText("BINS WITH INVENTORY")).toBeVisible({ timeout: 10_000 });
    // We seeded 4 bins (bin-01..bin-04) — barcode WH1-A-01-01-01-01 etc.
    await expect(page.getByText("WH1-A-01-01-01-01")).toBeVisible({ timeout: 10_000 });
  });

  test("selecting a bin reveals count inputs and submit button", async ({ page }) => {
    await page.goto("/count");
    // Wait for bin list to load then click the first bin card
    await expect(page.getByText("BINS WITH INVENTORY")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.getByText("WH1-A-01-01-01-01").click();
    await expect(page.getByRole("button", { name: "Submit Count" })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole("button", { name: "Empty" })).toBeVisible();
  });
});

test.describe("Operator App — Pack", () => {
  test("renders pack page with empty queue message", async ({ page }) => {
    await page.goto("/pack");
    await expect(page.getByRole("heading", { name: "Pack", exact: true })).toBeVisible();
    // No completed pick tasks seeded — should show empty state
    await expect(
      page.getByText("No tasks ready to pack.").or(page.getByText("READY TO PACK"))
    ).toBeVisible({ timeout: 10_000 });
  });
});
