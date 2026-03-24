/**
 * @jest-environment node
 *
 * Tests for billing operations workbench:
 * - addManualCharge / voidBillingEvent / getUnbilledEvents / getBillingDashboard
 * - approveInvoice / rejectInvoice / markInvoiceSent / markInvoicePaid / cancelInvoice
 * - createDispute / resolveDispute
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockDb = {
  billingEvent: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  invoice: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  billingDispute: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantAccess = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tenant-1",
        slug: "test",
        dbSchema: "test_schema",
        status: "active",
      }),
    },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn().mockReturnValue(mockDb),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "test" : null),
  }),
}));

beforeAll(() => {
  process.env.TENANT_RESOLUTION = "header";
});
afterAll(() => {
  delete process.env.TENANT_RESOLUTION;
});

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function asAdmin() {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "user-1",
      email: "admin@test.com",
      name: "Admin",
      isSuperadmin: false,
      tenants: [{ tenantId: "tenant-1", slug: "test", role: "admin", portalClientId: null }],
    },
    role: "admin",
  });
}

function resetMocks() {
  jest.clearAllMocks();
  asAdmin();
}

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  addManualCharge,
  voidBillingEvent,
  getUnbilledEvents,
  getBillingDashboard,
} from "@/modules/billing/charge-actions";

import {
  approveInvoice,
  rejectInvoice,
  markInvoiceSent,
  markInvoicePaid,
  cancelInvoice,
  createDispute,
  resolveDispute,
} from "@/modules/billing/invoice-actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Billing operations workbench", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── Charge adjustments ───────────────────────────────────────────────────

  describe("addManualCharge", () => {
    it("creates event with isManual=true and computed amount", async () => {
      mockDb.billingEvent.create.mockResolvedValue({ id: "evt-1" });

      const result = await addManualCharge({
        clientId: "client-1",
        serviceType: "storage",
        qty: 5,
        unitRate: 10,
        description: "Manual storage charge",
      });

      expect(result).toEqual({ id: "evt-1" });
      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: "client-1",
          isManual: true,
          amount: 50,
          qty: 5,
          unitRate: 10,
        }),
      });
    });

    it("validates required fields — rejects empty clientId", async () => {
      const result = await addManualCharge({
        clientId: "",
        serviceType: "storage",
        qty: 5,
        unitRate: 10,
        description: "Bad charge",
      });

      expect(result.error).toBeDefined();
      expect(mockDb.billingEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("voidBillingEvent", () => {
    it("sets voidedAt and voidReason", async () => {
      mockDb.billingEvent.findUniqueOrThrow.mockResolvedValue({
        id: "evt-1",
        voidedAt: null,
        invoiceId: null,
      });
      mockDb.billingEvent.update.mockResolvedValue({});

      const result = await voidBillingEvent("evt-1", "Duplicate charge");

      expect(result).toEqual({});
      expect(mockDb.billingEvent.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          voidReason: "Duplicate charge",
          voidedAt: expect.any(Date),
        }),
      });
    });

    it("is idempotent — already voided returns success", async () => {
      mockDb.billingEvent.findUniqueOrThrow.mockResolvedValue({
        id: "evt-1",
        voidedAt: new Date(),
        invoiceId: null,
      });

      const result = await voidBillingEvent("evt-1", "Dup");

      expect(result).toEqual({});
      expect(mockDb.billingEvent.update).not.toHaveBeenCalled();
    });

    it("rejects if event is already invoiced", async () => {
      mockDb.billingEvent.findUniqueOrThrow.mockResolvedValue({
        id: "evt-1",
        voidedAt: null,
        invoiceId: "inv-1",
      });

      const result = await voidBillingEvent("evt-1", "Should fail");

      expect(result.error).toContain("Cannot void an invoiced charge");
      expect(mockDb.billingEvent.update).not.toHaveBeenCalled();
    });
  });

  // ── Invoice approval ─────────────────────────────────────────────────────

  describe("approveInvoice", () => {
    it("sets reviewStatus to review_approved", async () => {
      mockDb.invoice.update.mockResolvedValue({});

      const result = await approveInvoice("inv-1", "Looks good");

      expect(result).toEqual({});
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          reviewStatus: "review_approved",
          reviewedById: "user-1",
          reviewNotes: "Looks good",
        }),
      });
    });
  });

  describe("rejectInvoice", () => {
    it("sets reviewStatus to review_rejected with notes", async () => {
      mockDb.invoice.update.mockResolvedValue({});

      const result = await rejectInvoice("inv-1", "Incorrect rates");

      expect(result).toEqual({});
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          reviewStatus: "review_rejected",
          reviewNotes: "Incorrect rates",
        }),
      });
    });
  });

  describe("markInvoiceSent", () => {
    it("sets status to sent with sentAt", async () => {
      mockDb.invoice.update.mockResolvedValue({});

      const result = await markInvoiceSent("inv-1", "email");

      expect(result).toEqual({});
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          status: "sent",
          sentAt: expect.any(Date),
          sentMethod: "email",
        }),
      });
    });
  });

  describe("markInvoicePaid", () => {
    it("sets status to paid with paidAt", async () => {
      mockDb.invoice.update.mockResolvedValue({});

      const result = await markInvoicePaid("inv-1");

      expect(result).toEqual({});
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          status: "paid",
          paidAt: expect.any(Date),
        }),
      });
    });
  });

  describe("cancelInvoice", () => {
    it("unlinks billing events (sets invoiceId null) then cancels", async () => {
      mockDb.billingEvent.updateMany.mockResolvedValue({ count: 3 });
      mockDb.invoice.update.mockResolvedValue({});

      const result = await cancelInvoice("inv-1");

      expect(result).toEqual({});

      // Events unlinked first
      expect(mockDb.billingEvent.updateMany).toHaveBeenCalledWith({
        where: { invoiceId: "inv-1" },
        data: { invoiceId: null },
      });

      // Then invoice cancelled
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: "cancelled" },
      });

      // Confirm ordering: updateMany called before invoice.update
      const unlinkOrder = mockDb.billingEvent.updateMany.mock.invocationCallOrder[0];
      const cancelOrder = mockDb.invoice.update.mock.invocationCallOrder[0];
      expect(unlinkOrder).toBeLessThan(cancelOrder);
    });
  });

  // ── Disputes ─────────────────────────────────────────────────────────────

  describe("createDispute", () => {
    it("creates dispute linked to invoice", async () => {
      mockDb.invoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv-1",
        clientId: "client-1",
      });
      mockDb.billingDispute.create.mockResolvedValue({ id: "disp-1" });

      const result = await createDispute({
        invoiceId: "inv-1",
        reason: "Overcharged",
        amount: 100,
      });

      expect(result).toEqual({ id: "disp-1" });
      expect(mockDb.billingDispute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: "inv-1",
          clientId: "client-1",
          reason: "Overcharged",
          amount: 100,
        }),
      });
    });
  });

  describe("resolveDispute", () => {
    it("with dispute_resolved_credit creates negative billing event", async () => {
      mockDb.billingDispute.update.mockResolvedValue({});
      mockDb.billingDispute.findUnique.mockResolvedValue({
        id: "disp-1",
        clientId: "client-1",
        amount: 50,
      });
      mockDb.billingEvent.create.mockResolvedValue({ id: "credit-1" });

      const result = await resolveDispute("disp-1", "dispute_resolved_credit", "Issuing credit");

      expect(result).toEqual({});
      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: "client-1",
          amount: -50,
          isManual: true,
          referenceType: "dispute",
          referenceId: "disp-1",
        }),
      });
    });

    it("with dispute_resolved_rejected does NOT create credit", async () => {
      mockDb.billingDispute.update.mockResolvedValue({});

      const result = await resolveDispute("disp-1", "dispute_resolved_rejected", "Not valid");

      expect(result).toEqual({});
      expect(mockDb.billingEvent.create).not.toHaveBeenCalled();
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────

  describe("getBillingDashboard", () => {
    it("returns aggregated counts", async () => {
      mockDb.billingEvent.aggregate.mockResolvedValue({
        _count: 12,
        _sum: { amount: 4800 },
      });
      mockDb.invoice.count.mockResolvedValue(3);
      mockDb.billingDispute.count.mockResolvedValue(2);
      mockDb.invoice.aggregate.mockResolvedValue({
        _sum: { total: 1200 },
      });

      const result = await getBillingDashboard();

      expect(result).toEqual({
        unbilledCount: 12,
        unbilledAmount: 4800,
        pendingReview: 3,
        openDisputes: 2,
        overdueAmount: 1200,
      });
    });
  });

  // ── Unbilled events ──────────────────────────────────────────────────────

  describe("getUnbilledEvents", () => {
    it("filters by clientId when provided", async () => {
      mockDb.billingEvent.findMany.mockResolvedValue([]);

      await getUnbilledEvents("client-1");

      expect(mockDb.billingEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceId: null, voidedAt: null, clientId: "client-1" },
        })
      );
    });
  });
});
