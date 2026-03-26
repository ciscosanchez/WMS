import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Ramola WMS E2E tests.
 *
 * Pattern designed to be reusable across projects (DispatchPro, etc.):
 * - Shared auth helpers in tests/e2e/auth.setup.ts
 * - Tenant cookie injection for multi-tenant apps
 * - Same webServer config pattern for any Next.js project
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile viewport for operator/kiosk screens
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
      testMatch: /operator|receive|pick|pack|move|count/,
    },
  ],
  webServer: {
    command:
      "USE_MOCK_AUTH=true TENANT_RESOLUTION=header DEFAULT_TENANT_SLUG=armstrong npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
