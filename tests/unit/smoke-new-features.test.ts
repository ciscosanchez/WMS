/**
 * @jest-environment node
 *
 * Smoke tests for new feature modules.
 * Verifies that all recently added server actions, cron routes,
 * and utility modules export the expected symbols without errors.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mocks ────────────────────────────────────────────────────────────────────
// Heavy dependencies that are not needed for import verification.

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: jest.fn(),
}));

jest.mock("@/lib/auth/rbac", () => ({
  getAccessibleWarehouseIds: jest.fn(),
  PERMISSIONS: {},
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {},
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn(),
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn(),
}));

jest.mock("@/lib/jobs/queue", () => ({
  notificationQueue: { add: jest.fn() },
  integrationQueue: { add: jest.fn() },
  emailQueue: { add: jest.fn() },
  slottingQueue: { add: jest.fn() },
  reportQueue: { add: jest.fn() },
}));

jest.mock("@/lib/events/event-bus", () => ({
  publishShipmentStatus: jest.fn(),
}));

jest.mock("@/lib/security/cron-auth", () => ({
  verifyCronRequest: jest.fn(),
}));

jest.mock("@/lib/integrations/tenant-connectors", () => ({
  getActiveTenants: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/modules/billing/capture", () => ({
  captureEvent: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Smoke: backorder-actions exports", () => {
  it("exports getBackorders", async () => {
    const mod = await import("@/modules/orders/backorder-actions");
    expect(typeof mod.getBackorders).toBe("function");
  });

  it("exports checkBackorderFulfillment", async () => {
    const mod = await import("@/modules/orders/backorder-actions");
    expect(typeof mod.checkBackorderFulfillment).toBe("function");
  });

  it("exports retryBackorderAllocation", async () => {
    const mod = await import("@/modules/orders/backorder-actions");
    expect(typeof mod.retryBackorderAllocation).toBe("function");
  });
});

describe("Smoke: import-actions exports", () => {
  it("exports parseOrderCsv", async () => {
    const mod = await import("@/modules/orders/import-actions");
    expect(typeof mod.parseOrderCsv).toBe("function");
  });

  it("exports validateImportPreview", async () => {
    const mod = await import("@/modules/orders/import-actions");
    expect(typeof mod.validateImportPreview).toBe("function");
  });

  it("exports importOrders", async () => {
    const mod = await import("@/modules/orders/import-actions");
    expect(typeof mod.importOrders).toBe("function");
  });
});

describe("Smoke: cycle-count-actions exports", () => {
  it("exports getCycleCountPlans", async () => {
    const mod = await import("@/modules/inventory/cycle-count-actions");
    expect(typeof mod.getCycleCountPlans).toBe("function");
  });

  it("exports createCycleCountPlan", async () => {
    const mod = await import("@/modules/inventory/cycle-count-actions");
    expect(typeof mod.createCycleCountPlan).toBe("function");
  });

  it("exports submitCycleCount", async () => {
    const mod = await import("@/modules/inventory/cycle-count-actions");
    expect(typeof mod.submitCycleCount).toBe("function");
  });

  it("exports approveCycleCount", async () => {
    const mod = await import("@/modules/inventory/cycle-count-actions");
    expect(typeof mod.approveCycleCount).toBe("function");
  });
});

describe("Smoke: cycle-count-queries exports", () => {
  it("exports getPendingCycleCountAdjustments", async () => {
    const mod = await import("@/modules/inventory/cycle-count-queries");
    expect(typeof mod.getPendingCycleCountAdjustments).toBe("function");
  });
});

describe("Smoke: cron route handlers export GET", () => {
  it("storage-billing exports GET", async () => {
    const mod = await import("@/app/api/cron/storage-billing/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("scheduled-reports exports GET", async () => {
    const mod = await import("@/app/api/cron/scheduled-reports/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("replenishment exports GET", async () => {
    const mod = await import("@/app/api/cron/replenishment/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("low-stock-alerts exports GET", async () => {
    const mod = await import("@/app/api/cron/low-stock-alerts/route");
    expect(typeof mod.GET).toBe("function");
  });
});

describe("Smoke: structured logger", () => {
  it("exports logger with info, warn, error methods", async () => {
    const mod = await import("@/lib/logger");
    expect(typeof mod.logger.info).toBe("function");
    expect(typeof mod.logger.warn).toBe("function");
    expect(typeof mod.logger.error).toBe("function");
  });
});

describe("Smoke: error boundary component", () => {
  it("exports ErrorBoundary class and ErrorCard", async () => {
    const mod = await import("@/components/shared/error-boundary");
    expect(mod.ErrorBoundary).toBeDefined();
    expect(typeof mod.ErrorCard).toBe("function");
  });
});
