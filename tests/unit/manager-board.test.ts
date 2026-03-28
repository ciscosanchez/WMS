/**
 * Unit tests for getOperationsBoard() — manager operations board.
 * Verifies shift status, cross-task visibility, and notOnFloor list.
 */

const mockRequireTenantAccess = jest.fn();
const mockPublicDbTenantFindUnique = jest.fn();
const mockPublicDbTenantUserFindMany = jest.fn();
const mockGetTenantDb = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: { findUnique: (...args: unknown[]) => mockPublicDbTenantFindUnique(...args) },
    tenantUser: { findMany: (...args: unknown[]) => mockPublicDbTenantUserFindMany(...args) },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: (...args: unknown[]) => mockGetTenantDb(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
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

const WORKER_A = {
  userId: "user-a",
  user: { id: "user-a", name: "Alex", email: "a@test.com" },
  role: "warehouse_worker",
};
const WORKER_B = {
  userId: "user-b",
  user: { id: "user-b", name: "Brook", email: "b@test.com" },
  role: "warehouse_worker",
};
const MANAGER_C = {
  userId: "user-c",
  user: { id: "user-c", name: "Casey", email: "c@test.com" },
  role: "manager",
};

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    pickTask: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    inboundShipment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    operatorShift: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    receivingTransaction: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    inventoryAdjustment: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

function setupContext(members: (typeof WORKER_A)[], db: ReturnType<typeof makeDb>) {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "manager-1",
      email: "mgr@test.com",
      name: "Manager",
      isSuperadmin: false,
      tenants: [],
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
  mockPublicDbTenantUserFindMany.mockResolvedValue(members);
  mockGetTenantDb.mockReturnValue(db);
}

import { getOperationsBoard } from "@/modules/dashboard/manager-actions";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getOperationsBoard", () => {
  beforeEach(() => {
    mockRequireTenantAccess.mockReset();
    mockPublicDbTenantFindUnique.mockReset();
    mockPublicDbTenantUserFindMany.mockReset();
    mockGetTenantDb.mockReset();
  });

  describe("shift status", () => {
    it("marks operator as clockedIn when they have an active shift", async () => {
      const clockIn = new Date(Date.now() - 3600000); // 1 hour ago
      const db = makeDb({
        operatorShift: {
          findMany: jest.fn().mockResolvedValue([{ operatorId: WORKER_A.userId, clockIn }]),
        },
        receivingTransaction: {
          groupBy: jest
            .fn()
            .mockResolvedValue([{ receivedBy: WORKER_A.userId, _count: { id: 5 } }]),
        },
      });
      setupContext([WORKER_A, WORKER_B], db);

      const result = await getOperationsBoard();
      const opA = result.operators.find((o) => o.userId === WORKER_A.userId);

      expect(opA).toBeDefined();
      expect(opA?.clockedIn).toBe(true);
      expect(opA?.hoursOnShift).toBeGreaterThan(0.9);
    });

    it("marks operator as not clocked in when they have no active shift", async () => {
      const db = makeDb({
        receivingTransaction: {
          groupBy: jest
            .fn()
            .mockResolvedValue([{ receivedBy: WORKER_A.userId, _count: { id: 2 } }]),
        },
      });
      setupContext([WORKER_A], db);

      const result = await getOperationsBoard();
      const opA = result.operators.find((o) => o.userId === WORKER_A.userId);

      expect(opA?.clockedIn).toBe(false);
      expect(opA?.clockInTime).toBeNull();
    });
  });

  describe("cross-task visibility", () => {
    it("includes operator who only has receiving activity (no pick tasks)", async () => {
      const db = makeDb({
        receivingTransaction: {
          groupBy: jest
            .fn()
            .mockResolvedValue([{ receivedBy: WORKER_A.userId, _count: { id: 3 } }]),
        },
      });
      setupContext([WORKER_A, WORKER_B], db);

      const result = await getOperationsBoard();
      const opA = result.operators.find((o) => o.userId === WORKER_A.userId);

      expect(opA).toBeDefined();
      expect(opA?.receivingCount).toBe(3);
      expect(opA?.active).toBe(0); // no pick tasks
    });

    it("includes operator who is clocked in with no tasks", async () => {
      const db = makeDb({
        operatorShift: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ operatorId: WORKER_A.userId, clockIn: new Date() }]),
        },
      });
      setupContext([WORKER_A, WORKER_B], db);

      const result = await getOperationsBoard();
      const opA = result.operators.find((o) => o.userId === WORKER_A.userId);

      expect(opA).toBeDefined();
      expect(opA?.clockedIn).toBe(true);
    });

    it("includes cycle count tasks per operator", async () => {
      const db = makeDb({
        inventoryAdjustment: {
          groupBy: jest.fn().mockResolvedValue([{ createdBy: WORKER_A.userId, _count: { id: 4 } }]),
        },
      });
      setupContext([WORKER_A], db);

      const result = await getOperationsBoard();
      const opA = result.operators.find((o) => o.userId === WORKER_A.userId);

      expect(opA?.countTasks).toBe(4);
    });
  });

  describe("notOnFloor", () => {
    it("includes warehouse_worker with no shift or activity in notOnFloor", async () => {
      setupContext([WORKER_A, WORKER_B], makeDb());

      const result = await getOperationsBoard();

      expect(result.notOnFloor).toHaveLength(2);
      expect(result.notOnFloor.map((o) => o.userId)).toContain(WORKER_A.userId);
      expect(result.notOnFloor.map((o) => o.userId)).toContain(WORKER_B.userId);
    });

    it("does not include manager role in notOnFloor", async () => {
      setupContext([WORKER_A, MANAGER_C], makeDb());

      const result = await getOperationsBoard();

      // notOnFloor only includes warehouse_worker role
      expect(result.notOnFloor.map((o) => o.userId)).not.toContain(MANAGER_C.userId);
    });

    it("excludes operator from notOnFloor when they are clocked in", async () => {
      const db = makeDb({
        operatorShift: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ operatorId: WORKER_A.userId, clockIn: new Date() }]),
        },
      });
      setupContext([WORKER_A, WORKER_B], db);

      const result = await getOperationsBoard();

      expect(result.notOnFloor.map((o) => o.userId)).not.toContain(WORKER_A.userId);
      expect(result.notOnFloor.map((o) => o.userId)).toContain(WORKER_B.userId);
    });
  });
});
