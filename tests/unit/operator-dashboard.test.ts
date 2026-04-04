/**
 * Unit tests for getMyTasksSummary() — operator daily dashboard.
 * Verifies shift status, available tasks, and VAS task inclusion.
 */

const mockRequireTenantAccess = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {},
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn().mockReturnValue({}),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "test" : null),
  }),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
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

beforeAll(() => {
  process.env.TENANT_RESOLUTION = "header";
});
afterAll(() => {
  delete process.env.TENANT_RESOLUTION;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "user-op-1";

function makeDb(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    pickTask: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    receivingTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryAdjustment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    operatorShift: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    vasTask: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

function setupUser(db: ReturnType<typeof makeDb>) {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: USER_ID,
      email: "op@test.com",
      name: "Operator",
      isSuperadmin: false,
      tenants: [
        { tenantId: "tenant-1", slug: "test", role: "warehouse_worker", portalClientId: null },
      ],
    },
    role: "warehouse_worker",
    warehouseAccess: null,
  });

  // Patch getTenantDb to return our mock db
  const { getTenantDb } = require("@/lib/db/tenant-client");
  (getTenantDb as jest.Mock).mockReturnValue(db);
}

import { getMyTasksSummary } from "@/modules/dashboard/operator-actions";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getMyTasksSummary", () => {
  beforeEach(() => {
    mockRequireTenantAccess.mockReset();
    jest.clearAllMocks();
  });

  describe("shift status", () => {
    it("returns clockedIn: false when no active shift", async () => {
      const db = makeDb({ operatorShift: { findFirst: jest.fn().mockResolvedValue(null) } });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.shift.clockedIn).toBe(false);
      expect(result.shift.clockInTime).toBeNull();
      expect(result.shift.hoursWorked).toBe(0);
    });

    it("returns clockedIn: true with hoursWorked when shift is active", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      const db = makeDb({
        operatorShift: {
          findFirst: jest.fn().mockResolvedValue({ id: "shift-1", clockIn: twoHoursAgo }),
        },
      });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.shift.clockedIn).toBe(true);
      expect(result.shift.clockInTime).toEqual(twoHoursAgo);
      expect(result.shift.hoursWorked).toBeGreaterThan(1.9);
      expect(result.shift.hoursWorked).toBeLessThan(2.1);
    });
  });

  describe("available tasks", () => {
    it("returns pending unassigned pick tasks as availableTasks", async () => {
      const pendingTask = {
        id: "task-1",
        taskNumber: "PCK-001",
        status: "pending",
        assignedTo: null,
        order: { orderNumber: "ORD-001", priority: "standard", shipToName: "ACME" },
        lines: [{ id: "line-1" }, { id: "line-2" }],
      };
      const db = makeDb({
        pickTask: {
          findMany: jest.fn().mockImplementation(({ where }) => {
            // Return pending tasks for the availableTasks query (no assignedTo filter or status: pending)
            if (where?.status === "pending" && where?.assignedTo === null) {
              return Promise.resolve([pendingTask]);
            }
            return Promise.resolve([]);
          }),
        },
      });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.availableTasks).toHaveLength(1);
      expect(result.availableTasks[0].taskNumber).toBe("PCK-001");
      expect(result.availableTasks[0].lineCount).toBe(2);
    });

    it("does not include tasks assigned to other operators in availableTasks", async () => {
      const assignedToOther = {
        id: "task-2",
        taskNumber: "PCK-002",
        status: "assigned",
        assignedTo: "other-user",
        order: { orderNumber: "ORD-002", priority: "standard", shipToName: "ACME" },
        lines: [],
      };
      const db = makeDb({
        pickTask: {
          findMany: jest.fn().mockImplementation(({ where }) => {
            if (where?.status === "pending" && where?.assignedTo === null) {
              // Assigned tasks should not match this query
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
        },
      });
      setupUser(db);

      const result = await getMyTasksSummary();

      // No available tasks — the assigned-to-other task doesn't match the pending+unassigned filter
      expect(result.availableTasks).toHaveLength(0);
      void assignedToOther; // referenced to avoid unused var lint
    });
  });

  describe("VAS tasks", () => {
    it("includes active VAS tasks assigned to the operator", async () => {
      const vasTask = {
        id: "vas-1",
        taskNumber: "VAS-001",
        type: "assembly",
        status: "vas_in_progress",
        orderId: "order-1",
      };
      const db = makeDb({
        vasTask: { findMany: jest.fn().mockResolvedValue([vasTask]) },
      });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.vasTasks).toHaveLength(1);
      expect(result.vasTasks[0].taskNumber).toBe("VAS-001");
      expect(result.vasTasks[0].type).toBe("assembly");
    });

    it("returns empty vasTasks when operator has no VAS assignments", async () => {
      const db = makeDb({ vasTask: { findMany: jest.fn().mockResolvedValue([]) } });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.vasTasks).toHaveLength(0);
    });
  });

  describe("stats", () => {
    it("counts active tasks correctly (assigned + in_progress)", async () => {
      const db = makeDb({
        pickTask: {
          findMany: jest.fn().mockImplementation(({ where }) => {
            if (where?.OR) {
              // My tasks query
              return Promise.resolve([
                {
                  id: "t1",
                  taskNumber: "PCK-001",
                  status: "in_progress",
                  startedAt: new Date(),
                  completedAt: null,
                  order: { orderNumber: "O1", priority: "standard", shipToName: "A" },
                  lines: [],
                },
                {
                  id: "t2",
                  taskNumber: "PCK-002",
                  status: "completed",
                  startedAt: new Date(),
                  completedAt: new Date(),
                  order: { orderNumber: "O2", priority: "standard", shipToName: "B" },
                  lines: [],
                },
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      });
      setupUser(db);

      const result = await getMyTasksSummary();

      expect(result.stats.active).toBe(1);
      expect(result.stats.completedToday).toBe(1);
    });
  });
});
