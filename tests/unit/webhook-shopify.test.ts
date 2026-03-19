/**
 * @jest-environment node
 *
 * Shopify webhook signature verification:
 * - Missing SHOPIFY_WEBHOOK_SECRET → always 401
 * - Invalid HMAC → 401
 * - Valid HMAC → not 401
 */

import crypto from "crypto";
import { NextRequest } from "next/server";

function makeShopifyRequest(body: string, secret: string | null, topic = "orders/create"): NextRequest {
  const hmac = secret
    ? crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
    : "bad-hmac";

  return new NextRequest("http://localhost/api/webhooks/shopify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": "test.myshopify.com",
    },
    body,
  });
}

describe("Shopify webhook — fail-closed signature verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 401 when SHOPIFY_WEBHOOK_SECRET is not set", async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const res = await POST(makeShopifyRequest("{}", null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when HMAC is invalid", async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = "real-secret";
    const req = new NextRequest("http://localhost/api/webhooks/shopify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "not-valid-base64-hmac",
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-domain": "test.myshopify.com",
      },
      body: "{}",
    });
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when HMAC is computed with wrong secret", async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = "real-secret";
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const res = await POST(makeShopifyRequest("{}", "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("does not return 401 when HMAC is valid", async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = "real-secret";
    const body = JSON.stringify({ id: 1, line_items: [] });
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const res = await POST(makeShopifyRequest(body, "real-secret", "orders/create"));
    // Auth passed — may get 200 or error from missing DB, but not 401
    expect(res.status).not.toBe(401);
  });
});
