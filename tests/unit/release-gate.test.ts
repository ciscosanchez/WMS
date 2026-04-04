/**
 * Unit tests for release gate server actions.
 * Covers getShipmentsReadyForRelease, releaseShipment, getReleasedShipmentsToday.
 */

const mockRequireTenantContext = jest.fn();
const mockMarkShipmentShipped = jest.fn();
const mockLogAudit = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/modules/shipping/ship-actions", () => ({
  markShipmentShipped: (...args: unknown[]) => mockMarkShipmentShipped(...args),
}));

jest.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(overrides: Record<string, unknown> = {}) {
  return {
    shipment: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    ...overrides,
  };
}

function setupContext(db: ReturnType<typeof makeTenantDb>, userId = "user-1") {
  mockRequireTenantContext.mockResolvedValue({
    user: { id: userId, email: "op@test.com", name: "Operator" },
    role: "warehouse_worker",
    warehouseAccess: null,
    tenant: {
      tenantId: "tenant-1",
      slug: "test",
      db,
    },
  });
}

import {
  getShipmentsReadyForRelease,
  releaseShipment,
  getReleasedShipmentsToday,
} from "@/modules/shipping/release-actions";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getShipmentsReadyForRelease", () => {
  beforeEach(() => {
    mockRequireTenantContext.mockReset();
  });

  it("queries for label_created shipments with null releasedAt", async () => {
    const db = makeTenantDb();
    setupContext(db);

    await getShipmentsReadyForRelease();

    expect(db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "label_created",
          releasedAt: null,
        }),
      })
    );
  });

  it("includes items and product fields in the result", async () => {
    const db = makeTenantDb();
    setupContext(db);

    await getShipmentsReadyForRelease();

    const call = (db.shipment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.include).toHaveProperty("items");
    expect(call.include.items.include).toHaveProperty("product");
    expect(call.include.items.include.product.select).toHaveProperty("unitsPerCase");
    expect(call.include.items.include.product.select).toHaveProperty("caseBarcode");
  });
});

describe("releaseShipment", () => {
  const SHIPMENT_ID = "ship-abc";
  const TRACKING = "1Z999AA10123456784";
  const CARRIER = "UPS";
  const USER_ID = "op-user-1";

  beforeEach(() => {
    mockRequireTenantContext.mockReset();
    mockMarkShipmentShipped.mockReset();
    mockLogAudit.mockReset();
    mockRevalidatePath.mockReset();
  });

  it("stamps releasedAt and releasedBy, calls markShipmentShipped, revalidates paths", async () => {
    const db = makeTenantDb({
      shipment: {
        findUnique: jest.fn().mockResolvedValue({ status: "label_created", releasedAt: null }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    setupContext(db, USER_ID);
    mockMarkShipmentShipped.mockResolvedValue({});

    const result = await releaseShipment(SHIPMENT_ID, TRACKING, CARRIER);

    expect(result).toEqual({});
    expect(db.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SHIPMENT_ID },
        data: expect.objectContaining({ releasedBy: USER_ID }),
      })
    );
    expect(mockMarkShipmentShipped).toHaveBeenCalledWith(SHIPMENT_ID, TRACKING, CARRIER);
    expect(mockLogAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        action: "update",
        entityType: "shipment",
        entityId: SHIPMENT_ID,
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/release");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/operations");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/shipping");
  });

  it("is idempotent — returns success without calling markShipmentShipped if already released", async () => {
    const db = makeTenantDb({
      shipment: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: "shipped", releasedAt: new Date(), releasedBy: USER_ID }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    setupContext(db, USER_ID);

    const result = await releaseShipment(SHIPMENT_ID, TRACKING, CARRIER);

    expect(result).toEqual({});
    expect(db.shipment.update).not.toHaveBeenCalled();
    expect(mockMarkShipmentShipped).not.toHaveBeenCalled();
  });

  it("returns error when shipment is not found", async () => {
    const db = makeTenantDb({
      shipment: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    setupContext(db, USER_ID);

    const result = await releaseShipment(SHIPMENT_ID, TRACKING, CARRIER);

    expect(result).toEqual({ error: "Shipment not found" });
    expect(db.shipment.update).not.toHaveBeenCalled();
  });

  it("propagates error from markShipmentShipped", async () => {
    const db = makeTenantDb({
      shipment: {
        findUnique: jest.fn().mockResolvedValue({ status: "label_created", releasedAt: null }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    setupContext(db, USER_ID);
    mockMarkShipmentShipped.mockResolvedValue({ error: "Inventory insufficient" });

    const result = await releaseShipment(SHIPMENT_ID, TRACKING, CARRIER);

    expect(result).toEqual({ error: "Inventory insufficient" });
  });
});

describe("getReleasedShipmentsToday", () => {
  beforeEach(() => {
    mockRequireTenantContext.mockReset();
  });

  it("queries for shipments with releasedAt >= start of today", async () => {
    const db = makeTenantDb();
    setupContext(db);

    await getReleasedShipmentsToday();

    const call = (db.shipment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.releasedAt).toHaveProperty("gte");
    const gte = call.where.releasedAt.gte as Date;
    expect(gte.getHours()).toBe(0);
    expect(gte.getMinutes()).toBe(0);
    expect(gte.getSeconds()).toBe(0);
  });
});

// ── qtyLabel display logic (pure function) ────────────────────────────────────

describe("qtyLabel display logic", () => {
  function qtyLabel(quantity: number, unitsPerCase: number | null, baseUom: string | null) {
    const upc = unitsPerCase;
    if (upc && upc > 1) {
      return `${quantity} ${baseUom ?? "EA"} = ${quantity * upc} units`;
    }
    return `${quantity} ${baseUom ?? "EA"}`;
  }

  it("shows carton × units expansion when unitsPerCase > 1", () => {
    expect(qtyLabel(3, 12, "CS")).toBe("3 CS = 36 units");
  });

  it("shows plain qty when unitsPerCase is null", () => {
    expect(qtyLabel(5, null, "EA")).toBe("5 EA");
  });

  it("shows plain qty when unitsPerCase is 1 (guard upc > 1)", () => {
    expect(qtyLabel(2, 1, "EA")).toBe("2 EA");
  });

  it("defaults to EA when baseUom is null", () => {
    expect(qtyLabel(4, null, null)).toBe("4 EA");
  });
});
