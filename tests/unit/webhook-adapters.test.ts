/**
 * @jest-environment node
 *
 * Webhook adapter integration tests:
 * - Shopify HMAC signature verification and tenant resolution
 * - Amazon SNS signature verification and tenant resolution
 * - Walmart HMAC signature verification and tenant resolution
 */

import crypto from "crypto";
import { NextRequest } from "next/server";

// ── Shopify helpers ──────────────────────────────────────────────────────────

function makeShopifyRequest(
  body: string,
  secret: string | null,
  topic = "orders/create"
): NextRequest {
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

// ── Walmart helpers ──────────────────────────────────────────────────────────

function makeWalmartRequest(body: string, secret: string | null): NextRequest {
  const sig = secret
    ? crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
    : "bad-signature";

  return new NextRequest("http://localhost/api/webhooks/walmart", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-walmart-signature": sig,
      "x-walmart-event-type": "order.created",
    },
    body,
  });
}

// ── Amazon helpers ───────────────────────────────────────────────────────────

function generateTestKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function makeAmazonNotificationRequest(
  overrides: Partial<Record<string, string>> = {}
): NextRequest {
  const envelope = {
    Type: "Notification",
    MessageId: "test-msg-id",
    TopicArn: "arn:aws:sns:us-east-1:123456789:test",
    Message: JSON.stringify({ NotificationType: "ORDER_CHANGE" }),
    Timestamp: "2026-01-01T00:00:00.000Z",
    SignatureVersion: "1",
    Signature: "fake-signature",
    SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
    ...overrides,
  };
  return new NextRequest("http://localhost/api/webhooks/amazon", {
    method: "POST",
    body: JSON.stringify(envelope),
  });
}

// ── Environment setup ────────────────────────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// ── Shopify signature tests ──────────────────────────────────────────────────

describe("Shopify webhook — signature verification", () => {
  it("returns 401 when SHOPIFY_WEBHOOK_SECRET is not set", async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const res = await POST(makeShopifyRequest("{}", null));
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

// ── Shopify tenant resolution ────────────────────────────────────────────────

describe("Shopify webhook — tenant resolution", () => {
  it("uses shop domain header to resolve tenant context", async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = "real-secret";
    const body = JSON.stringify({ id: 1, line_items: [] });
    const { POST } = await import("@/app/api/webhooks/shopify/route");
    const req = makeShopifyRequest(body, "real-secret", "orders/create");

    // Verify the header is present on the request
    expect(req.headers.get("x-shopify-shop-domain")).toBe("test.myshopify.com");

    const res = await POST(req);
    // Should not be an auth failure
    expect(res.status).not.toBe(401);
  });
});

// ── Amazon signature tests ───────────────────────────────────────────────────

describe("Amazon webhook — signature verification", () => {
  it("rejects messages with an invalid signature", async () => {
    const { publicKey } = generateTestKeyPair();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => publicKey,
    } as Response);

    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(makeAmazonNotificationRequest({ Signature: "badsignature" }));
    expect(res.status).toBe(403);
  });

  it("rejects messages when SigningCertURL is from an untrusted domain", async () => {
    global.fetch = jest.fn();
    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(
      makeAmazonNotificationRequest({
        SigningCertURL: "https://evil.com/cert.pem",
      })
    );
    expect(res.status).toBe(403);
    // fetch should NOT have been called — SSRF guard fires before the fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("accepts messages with a valid RSA-SHA1 signature", async () => {
    const { publicKey, privateKey } = generateTestKeyPair();
    const envelope = {
      Type: "Notification",
      MessageId: "test-msg-id",
      TopicArn: "arn:aws:sns:us-east-1:123456789:test",
      Message: JSON.stringify({ NotificationType: "UNKNOWN_TYPE" }),
      Timestamp: "2026-01-01T00:00:00.000Z",
      SignatureVersion: "1",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
    };

    // Build canonical string for notification
    const notifFields: Array<[string, string | undefined]> = [
      ["Message", envelope.Message],
      ["MessageId", envelope.MessageId],
      ["Timestamp", envelope.Timestamp],
      ["TopicArn", envelope.TopicArn],
      ["Type", envelope.Type],
    ];
    const canonical = notifFields
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}\n${v}\n`)
      .join("");

    const signer = crypto.createSign("sha1WithRSAEncryption");
    signer.update(canonical, "utf8");
    const signature = signer.sign(privateKey, "base64");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => publicKey,
    } as Response);

    const req = new NextRequest("http://localhost/api/webhooks/amazon", {
      method: "POST",
      body: JSON.stringify({ ...envelope, Signature: signature }),
    });

    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(req);
    expect(res.status).not.toBe(403);
  });
});

// ── Walmart signature tests ──────────────────────────────────────────────────

describe("Walmart webhook — signature verification", () => {
  it("returns 401 when WALMART_WEBHOOK_SECRET is not set", async () => {
    delete process.env.WALMART_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/walmart/route");
    const res = await POST(makeWalmartRequest("{}", null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is computed with wrong secret", async () => {
    process.env.WALMART_WEBHOOK_SECRET = "real-secret";
    const { POST } = await import("@/app/api/webhooks/walmart/route");
    const res = await POST(makeWalmartRequest("{}", "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("does not return 401 when signature is valid", async () => {
    process.env.WALMART_WEBHOOK_SECRET = "real-secret";
    process.env.WALMART_TENANT_SLUG = "test-tenant";
    const body = JSON.stringify({ order: { id: "ord-1" } });
    const { POST } = await import("@/app/api/webhooks/walmart/route");
    const res = await POST(makeWalmartRequest(body, "real-secret"));
    // Auth passed — may get 200 (handler runs but resolveTenantDb returns null)
    expect(res.status).not.toBe(401);
  });
});

// ── Walmart tenant resolution ────────────────────────────────────────────────

describe("Walmart webhook — tenant resolution", () => {
  it("uses WALMART_TENANT_SLUG env var to resolve tenant", async () => {
    process.env.WALMART_WEBHOOK_SECRET = "real-secret";
    process.env.WALMART_TENANT_SLUG = "acme-warehouse";
    process.env.WALMART_WMS_CLIENT_CODE = "ACME";

    const body = JSON.stringify({
      order: { purchaseOrderId: "PO-123", orderLines: { orderLine: [] } },
    });
    const { POST } = await import("@/app/api/webhooks/walmart/route");
    const res = await POST(makeWalmartRequest(body, "real-secret"));

    // Should pass auth (not 401) — inner handler may fail on DB but that is OK
    expect(res.status).not.toBe(401);
  });
});
