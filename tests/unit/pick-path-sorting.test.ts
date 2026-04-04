/**
 * Unit tests for pick path optimization feature (#7).
 *
 * Tests:
 * 1. Pick task lines are sorted by bin barcode (pick path order)
 * 2. Putaway suggestions return bins with existing stock first
 * 3. Empty inventory case returns empty array
 */

const mockRequireTenantAccess = jest.fn();
const mockPublicDbTenantFindUnique = jest.fn();
const mockGetTenantDb = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: { findUnique: (...args: unknown[]) => mockPublicDbTenantFindUnique(...args) },
    tenantUser: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: (...args: unknown[]) => mockGetTenantDb(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "user-op-1";

function setupOperatorContext(db: Record<string, unknown>) {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: USER_ID,
      email: "op@test.com",
      name: "Operator One",
      isSuperadmin: false,
      tenants: [
        { tenantId: "tenant-1", slug: "test", role: "warehouse_worker", portalClientId: null },
      ],
    },
    role: "warehouse_worker",
    warehouseAccess: null,
  });
  mockPublicDbTenantFindUnique.mockResolvedValue({
    id: "tenant-1",
    slug: "test",
    dbSchema: "test_schema",
    status: "active",
  });
  mockGetTenantDb.mockReturnValue(db);
}

function setupManagerContext(db: Record<string, unknown>) {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "manager-1",
      email: "mgr@test.com",
      name: "Manager",
      isSuperadmin: false,
      tenants: [{ tenantId: "tenant-1", slug: "test", role: "manager", portalClientId: null }],
    },
    role: "manager",
    warehouseAccess: null,
  });
  mockPublicDbTenantFindUnique.mockResolvedValue({
    id: "tenant-1",
    slug: "test",
    dbSchema: "test_schema",
    status: "active",
  });
  mockGetTenantDb.mockReturnValue(db);
}

/** Build a mock pick task line at the given bin barcode */
function makeLine(id: string, binBarcode: string, pickedQty = 0) {
  return {
    id,
    taskId: "task-1",
    productId: "prod-1",
    binId: `bin-${id}`,
    quantity: 10,
    pickedQty,
    lotNumber: null,
    serialNumber: null,
    product: { id: "prod-1", sku: "SKU-001", name: "Widget", barcode: null },
    bin: { id: `bin-${id}`, code: `BIN-${id}`, barcode: binBarcode, status: "available" },
  };
}

import { getMyPickTasks } from "@/modules/operator/actions";
import { getPutawaySuggestions } from "@/modules/receiving/putaway-suggestions";

// ── Tests: Pick line sorting ──────────────────────────────────────────────────

describe("getMyPickTasks — pick path sorting", () => {
  beforeEach(() => {
    mockRequireTenantAccess.mockReset();
    mockPublicDbTenantFindUnique.mockReset();
    mockGetTenantDb.mockReset();
    jest.clearAllMocks();
  });

  it("returns lines sorted by bin barcode (lexicographic pick path order)", async () => {
    // Lines given in un-sorted order: C → A → B
    const unsortedLines = [
      makeLine("c", "MEM-01-C-01-01-03"),
      makeLine("a", "MEM-01-A-01-01-01"),
      makeLine("b", "MEM-01-B-01-01-02"),
    ];

    // Simulate Prisma returning lines already sorted (orderBy: { bin: { barcode: "asc" } })
    // The sorted order should be A → B → C
    const sortedLines = [...unsortedLines].sort((x, y) =>
      x.bin.barcode.localeCompare(y.bin.barcode)
    );

    const mockTask = {
      id: "task-1",
      taskNumber: "PCK-001",
      status: "in_progress",
      assignedTo: USER_ID,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      orderId: "order-1",
      order: { id: "order-1", orderNumber: "ORD-001", priority: "standard", shipToName: "ACME" },
      lines: sortedLines, // Prisma returns them sorted
    };

    const db = {
      pickTask: {
        findMany: jest.fn().mockResolvedValue([mockTask]),
      },
    };
    setupOperatorContext(db);

    const tasks = await getMyPickTasks();

    expect(tasks).toHaveLength(1);
    const lines = tasks[0].lines;
    expect(lines).toHaveLength(3);
    // Assert the pick path order: A → B → C
    expect(lines[0].bin.barcode).toBe("MEM-01-A-01-01-01");
    expect(lines[1].bin.barcode).toBe("MEM-01-B-01-01-02");
    expect(lines[2].bin.barcode).toBe("MEM-01-C-01-01-03");
  });

  it("passes orderBy: { bin: { barcode: 'asc' } } to the lines include", async () => {
    const db = {
      pickTask: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    setupOperatorContext(db);

    await getMyPickTasks();

    // Verify the query included the sort directive
    const call = (db.pickTask.findMany as jest.Mock).mock.calls[0][0];
    expect(call.include.lines.orderBy).toEqual({ bin: { barcode: "asc" } });
  });

  it("returns empty array when operator has no active tasks", async () => {
    const db = {
      pickTask: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    setupOperatorContext(db);

    const result = await getMyPickTasks();
    expect(result).toEqual([]);
  });
});

// ── Tests: Putaway suggestions ────────────────────────────────────────────────

describe("getPutawaySuggestions", () => {
  const PRODUCT_ID = "prod-abc";
  const WAREHOUSE_ID = "wh-1";
  const AISLE_ID = "aisle-1";

  function makeInventoryRecord(binId: string, binBarcode: string, onHand: number) {
    return {
      onHand,
      bin: {
        id: binId,
        code: binBarcode.split("-").slice(-1)[0],
        barcode: binBarcode,
        shelf: {
          rack: {
            aisle: { id: AISLE_ID },
          },
        },
      },
    };
  }

  function makeBin(id: string, barcode: string) {
    return { id, code: barcode.split("-").slice(-1)[0], barcode };
  }

  beforeEach(() => {
    mockRequireTenantAccess.mockReset();
    mockPublicDbTenantFindUnique.mockReset();
    mockGetTenantDb.mockReset();
    jest.clearAllMocks();
  });

  it("returns bins with existing stock first (same distance)", async () => {
    const stockBin = makeInventoryRecord("bin-1", "MEM-01-A-01-01-01", 50);

    const db = {
      inventory: {
        findMany: jest.fn().mockResolvedValue([stockBin]),
      },
      bin: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    setupManagerContext(db);

    const results = await getPutawaySuggestions(PRODUCT_ID, WAREHOUSE_ID);

    expect(results).toHaveLength(1);
    expect(results[0].binId).toBe("bin-1");
    expect(results[0].onHand).toBe(50);
    expect(results[0].distance).toBe("same");
  });

  it("returns empty array when product has no existing inventory and no empty bins", async () => {
    const db = {
      inventory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bin: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    setupManagerContext(db);

    const results = await getPutawaySuggestions(PRODUCT_ID, WAREHOUSE_ID);

    expect(results).toHaveLength(0);
    expect(results).toEqual([]);
  });

  it("returns adjacent bins after same-distance bins", async () => {
    const stockBin = makeInventoryRecord("bin-1", "MEM-01-A-01-01-01", 20);
    const adjacentBin = makeBin("bin-2", "MEM-01-A-01-01-02");

    const db = {
      inventory: {
        findMany: jest.fn().mockResolvedValue([stockBin]),
      },
      bin: {
        findMany: jest
          .fn()
          // First call: adjacent bins in same aisle
          .mockResolvedValueOnce([adjacentBin])
          // Second call: other bins (not needed since we have 2 already < 5)
          .mockResolvedValueOnce([]),
      },
    };
    setupManagerContext(db);

    const results = await getPutawaySuggestions(PRODUCT_ID, WAREHOUSE_ID);

    expect(results).toHaveLength(2);
    expect(results[0].distance).toBe("same");
    expect(results[0].binId).toBe("bin-1");
    expect(results[1].distance).toBe("adjacent");
    expect(results[1].binId).toBe("bin-2");
  });

  it("returns other bins when no same or adjacent bins exist", async () => {
    const otherBin = makeBin("bin-far", "MEM-02-A-01-01-01");

    const db = {
      inventory: {
        // No existing stock → occupiedAisleIds will be empty → adjacent query is skipped
        findMany: jest.fn().mockResolvedValue([]),
      },
      bin: {
        // Only the "other" query fires (adjacent is skipped when occupiedAisleIds is empty)
        findMany: jest.fn().mockResolvedValue([otherBin]),
      },
    };
    setupManagerContext(db);

    const results = await getPutawaySuggestions(PRODUCT_ID, WAREHOUSE_ID);

    expect(results).toHaveLength(1);
    expect(results[0].distance).toBe("other");
    expect(results[0].binId).toBe("bin-far");
  });

  it("skips adjacent and other queries when existing stock fills all 5 slots", async () => {
    // 5 bins with existing stock → early-return guard fires, bin.findMany never called
    const stockBins = Array.from({ length: 5 }, (_, i) =>
      makeInventoryRecord(`bin-${i}`, `MEM-01-A-0${i}-01-01`, 10 * (5 - i))
    );

    const binFindMany = jest.fn().mockResolvedValue([]);
    const db = {
      inventory: { findMany: jest.fn().mockResolvedValue(stockBins) },
      bin: { findMany: binFindMany },
    };
    setupManagerContext(db);

    const results = await getPutawaySuggestions(PRODUCT_ID, WAREHOUSE_ID);

    // All results are "same" distance, no bin queries needed
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.distance === "same")).toBe(true);
    expect(binFindMany).not.toHaveBeenCalled();
  });
});
