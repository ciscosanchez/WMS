/**
 * @jest-environment node
 *
 * Amazon SNS webhook security tests:
 * 1. SNS signature verification (RSA-SHA1)
 * 2. SSRF protection — SubscribeURL must be from sns.*.amazonaws.com
 * 3. SigningCertURL domain validation
 */

import { NextRequest } from "next/server";
import crypto from "crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a canonical notification string the same way the production code does */
function buildCanonical(msg: Record<string, string>): string {
  const notifFields: Array<[string, string | undefined]> = [
    ["Message", msg.Message],
    ["MessageId", msg.MessageId],
    ...(msg.Subject ? [["Subject", msg.Subject] as [string, string]] : []),
    ["Timestamp", msg.Timestamp],
    ["TopicArn", msg.TopicArn],
    ["Type", msg.Type],
  ];
  return notifFields
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}\n${v}\n`)
    .join("");
}

/** Generate a self-signed RSA key pair for test use */
function generateTestKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

/** Sign a canonical string with the test private key */
function signCanonical(canonical: string, privateKey: string): string {
  const signer = crypto.createSign("sha1WithRSAEncryption");
  signer.update(canonical, "utf8");
  return signer.sign(privateKey, "base64");
}

function makeNotificationRequest(overrides: Partial<Record<string, string>> = {}): NextRequest {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Amazon webhook — SNS signature verification", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("rejects messages with an invalid signature", async () => {
    // Mock fetch for the cert URL — return a valid-looking PEM but signature won't match
    const { publicKey } = generateTestKeyPair();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => publicKey,
    } as Response);

    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(makeNotificationRequest({ Signature: "badsignature" }));
    expect(res.status).toBe(403);
  });

  it("rejects messages when SigningCertURL is from an untrusted domain", async () => {
    global.fetch = jest.fn();
    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(
      makeNotificationRequest({
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
    const canonical = buildCanonical(envelope as Record<string, string>);
    const signature = signCanonical(canonical, privateKey);

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
    // Signature valid → auth passed (200 or other non-403)
    expect(res.status).not.toBe(403);
  });
});

describe("Amazon webhook — SSRF protection (SubscribeURL)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("rejects SubscribeURL not from amazonaws.com", async () => {
    const { publicKey, privateKey } = generateTestKeyPair();
    // Build a valid subscription confirmation with a malicious SubscribeURL
    const envelope: Record<string, string> = {
      Type: "SubscriptionConfirmation",
      MessageId: "test-msg-id",
      TopicArn: "arn:aws:sns:us-east-1:123456789:test",
      Message: "You have chosen to subscribe.",
      Timestamp: "2026-01-01T00:00:00.000Z",
      Token: "test-token",
      SignatureVersion: "1",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
      SubscribeURL: "https://evil-ssrf-target.com/internal?secret=true",
    };
    // Build canonical for SubscriptionConfirmation
    const fields: Array<[string, string]> = [
      ["Message", envelope.Message],
      ["MessageId", envelope.MessageId],
      ["SubscribeURL", envelope.SubscribeURL],
      ["Timestamp", envelope.Timestamp],
      ["Token", envelope.Token],
      ["TopicArn", envelope.TopicArn],
      ["Type", envelope.Type],
    ];
    const canonical = fields.map(([k, v]) => `${k}\n${v}\n`).join("");
    const signature = signCanonical(canonical, privateKey);

    let subscribeUrlFetched = false;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === envelope.SigningCertURL) {
        return Promise.resolve({ ok: true, text: async () => publicKey });
      }
      if (url === envelope.SubscribeURL) {
        subscribeUrlFetched = true;
        return Promise.resolve({ ok: true, text: async () => "" });
      }
      return Promise.reject(new Error("unexpected fetch"));
    });

    const req = new NextRequest("http://localhost/api/webhooks/amazon", {
      method: "POST",
      body: JSON.stringify({ ...envelope, Signature: signature }),
    });

    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(subscribeUrlFetched).toBe(false); // Must not have fetched the SSRF target
  });

  it("accepts SubscribeURL from sns.*.amazonaws.com after valid signature", async () => {
    const { publicKey, privateKey } = generateTestKeyPair();
    const envelope: Record<string, string> = {
      Type: "SubscriptionConfirmation",
      MessageId: "test-msg-id",
      TopicArn: "arn:aws:sns:us-east-1:123456789:test",
      Message: "You have chosen to subscribe.",
      Timestamp: "2026-01-01T00:00:00.000Z",
      Token: "test-token",
      SignatureVersion: "1",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
      SubscribeURL: "https://sns.us-east-1.amazonaws.com/confirm?token=abc",
    };
    const fields: Array<[string, string]> = [
      ["Message", envelope.Message],
      ["MessageId", envelope.MessageId],
      ["SubscribeURL", envelope.SubscribeURL],
      ["Timestamp", envelope.Timestamp],
      ["Token", envelope.Token],
      ["TopicArn", envelope.TopicArn],
      ["Type", envelope.Type],
    ];
    const canonical = fields.map(([k, v]) => `${k}\n${v}\n`).join("");
    const signature = signCanonical(canonical, privateKey);

    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => publicKey });

    const req = new NextRequest("http://localhost/api/webhooks/amazon", {
      method: "POST",
      body: JSON.stringify({ ...envelope, Signature: signature }),
    });

    const { POST } = await import("@/app/api/webhooks/amazon/route");
    const res = await POST(req);

    expect(res.status).not.toBe(403);
    // SubscribeURL should have been fetched (confirmation occurred)
    const fetchCalls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url);
    expect(fetchCalls).toContain(envelope.SubscribeURL);
  });
});
