/**
 * @jest-environment node
 *
 * Verifies that all cron endpoints are fail-closed:
 * - Requests without CRON_SECRET set are rejected (401)
 * - Requests with a wrong secret are rejected (401)
 * - Requests with the correct secret pass auth (don't get a 401)
 */

import { NextRequest } from "next/server";

const ROUTES = [
  () => import("@/app/api/cron/shopify-sync/route"),
  () => import("@/app/api/cron/storage-billing/route"),
  () => import("@/app/api/cron/tracking-update/route"),
  () => import("@/app/api/cron/netsuite-sync/route"),
];

const ROUTE_NAMES = ["shopify-sync", "storage-billing", "tracking-update", "netsuite-sync"];

function makeRequest(secret?: string): NextRequest {
  const url = "http://localhost/api/cron/test";
  const headers: Record<string, string> = {};
  if (secret) headers["x-cron-secret"] = secret;
  return new NextRequest(url, { headers });
}

describe.each(ROUTES.map((r, i) => [ROUTE_NAMES[i], r]))(
  "cron/%s — fail-closed auth",
  (_name, importRoute) => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("returns 401 when CRON_SECRET is not set (no secret in request)", async () => {
      delete process.env.CRON_SECRET;
      const { GET } = await importRoute();
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET is not set (secret provided in request)", async () => {
      delete process.env.CRON_SECRET;
      const { GET } = await importRoute();
      const res = await GET(makeRequest("any-value"));
      expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET is set but request has wrong secret", async () => {
      process.env.CRON_SECRET = "correct-secret";
      const { GET } = await importRoute();
      const res = await GET(makeRequest("wrong-secret"));
      expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET is set but request has no secret", async () => {
      process.env.CRON_SECRET = "correct-secret";
      const { GET } = await importRoute();
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("does not return 401 when correct secret is provided", async () => {
      process.env.CRON_SECRET = "correct-secret";
      // Stub out downstream calls so the route doesn't crash
      jest.mock("@/lib/db/public-client", () => ({
        publicDb: { tenant: { findUnique: jest.fn().mockResolvedValue(null) } },
      }));
      const { GET } = await importRoute();
      const res = await GET(makeRequest("correct-secret"));
      expect(res.status).not.toBe(401);
    });
  }
);
