/**
 * @jest-environment node
 *
 * API hardening tests:
 * - Error responses never leak internal details (Prisma, stack traces)
 * - Upload endpoint enforces rate limiting
 * - All error responses use generic messages
 */

// Mock Redis to avoid real connection in tests (rate limiter falls back to in-memory)
jest.mock("@/lib/redis/client", () => ({
  redis: {
    status: "wait",
    connect: jest.fn().mockRejectedValue(new Error("Redis not available in test")),
    incr: jest.fn().mockRejectedValue(new Error("Redis not available in test")),
    expire: jest.fn(),
    ttl: jest.fn(),
    on: jest.fn(),
  },
  getRedis: jest.fn(),
}));

import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockValidateDispatchApiKey = jest.fn().mockReturnValue(true);

jest.mock("@/lib/integrations/dispatchpro/auth", () => ({
  validateDispatchApiKey: (...args: unknown[]) => mockValidateDispatchApiKey(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: "t1",
        slug: "test",
        dbSchema: "test_schema",
        status: "active",
      }),
    },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn().mockReturnValue({
    inventory: {
      findMany: jest.fn().mockRejectedValue(
        new Error("relation \"test_schema.inventory\" does not exist — DETAIL: Prisma query engine error at /engine/query.rs:442")
      ),
    },
    order: {
      findUnique: jest.fn().mockRejectedValue(
        new Error("PrismaClientKnownRequestError: Invalid `prisma.order.findUnique()` invocation")
      ),
    },
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("API error sanitization", () => {
  describe("GET /api/inventory — does not leak Prisma errors", () => {
    it("returns generic 'Internal error' message when DB throws", async () => {
      const { GET } = await import("@/app/api/inventory/route");
      const req = new NextRequest("http://localhost/api/inventory?tenantSlug=test");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Internal error");
      // Must NOT contain Prisma details
      expect(body.error).not.toContain("Prisma");
      expect(body.error).not.toContain("relation");
      expect(body.error).not.toContain("query.rs");
    });
  });

  describe("POST /api/shipments — does not leak Prisma errors", () => {
    it("returns generic 'Internal error' message when DB throws", async () => {
      const { POST } = await import("@/app/api/shipments/route");
      const req = new NextRequest("http://localhost/api/shipments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug: "test", wmsOrderId: "order-1" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Internal error");
      expect(body.error).not.toContain("PrismaClient");
    });
  });
});

describe("Rate limiter", () => {
  it("tracks requests per key and enforces limits", async () => {
    // Import the actual rate limiter module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RateLimiter } = require("@/lib/security/rate-limit");

    const limiter = new RateLimiter(3, 60_000); // 3 requests per minute

    const r1 = await limiter.check("test-key");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await limiter.check("test-key");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await limiter.check("test-key");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request should be blocked
    const r4 = await limiter.check("test-key");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);

    // Different key should still be allowed
    const r5 = await limiter.check("other-key");
    expect(r5.allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RateLimiter } = require("@/lib/security/rate-limit");

    const limiter = new RateLimiter(1, 50); // 1 request per 50ms

    const r1 = await limiter.check("expire-key");
    expect(r1.allowed).toBe(true);

    // Wait for window to expire
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    const r2 = await limiter.check("expire-key");
    expect(r2.allowed).toBe(true); // Should be allowed again
  });
});
