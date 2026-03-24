/**
 * @jest-environment node
 *
 * WooCommerce adapter unit tests:
 * - Order mapping (fields, statuses, addresses, line items)
 * - Webhook signature verification
 */

import crypto from "crypto";
import { NextRequest } from "next/server";

// ─── Sample WooCommerce order payload ─────────────────────────────────────────

const sampleWcOrder = {
  id: 727,
  number: "727",
  status: "processing",
  date_created: "2026-03-20T14:30:00",
  billing: {
    first_name: "John",
    last_name: "Doe",
    address_1: "123 Main St",
    address_2: "Apt 4",
    city: "Springfield",
    state: "IL",
    postcode: "62704",
    country: "US",
    email: "john@example.com",
    phone: "555-0100",
  },
  shipping: {
    first_name: "John",
    last_name: "Doe",
    address_1: "456 Oak Ave",
    address_2: "",
    city: "Shelbyville",
    state: "IL",
    postcode: "62565",
    country: "US",
  },
  line_items: [
    {
      id: 101,
      name: "Widget A",
      sku: "WGT-A",
      quantity: 3,
      price: "19.99",
      image: { src: "https://store.example.com/widget-a.jpg" },
    },
    {
      id: 102,
      name: "Gadget B",
      sku: "GDG-B",
      quantity: 1,
      price: "49.50",
      image: null,
    },
  ],
  shipping_lines: [{ method_title: "Flat Rate" }],
  customer_note: "Leave at front door",
};

// ─── Adapter mapping tests ────────────────────────────────────────────────────

describe("WooCommerceAdapter.mapOrder", () => {
  let adapter: InstanceType<
    typeof import("@/lib/integrations/marketplaces/woocommerce").WooCommerceAdapter
  >;

  beforeAll(async () => {
    const { WooCommerceAdapter } = await import("@/lib/integrations/marketplaces/woocommerce");
    adapter = new WooCommerceAdapter({
      storeUrl: "https://store.example.com",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
    });
  });

  it("maps basic order fields", () => {
    const mapped = adapter.mapOrder(sampleWcOrder);
    expect(mapped.externalId).toBe("727");
    expect(mapped.orderNumber).toBe("#727");
    expect(mapped.channel).toBe("WooCommerce");
    expect(mapped.priority).toBe("standard");
    expect(mapped.orderDate).toBeInstanceOf(Date);
  });

  it("maps shipping address (prefers shipping over billing)", () => {
    const mapped = adapter.mapOrder(sampleWcOrder);
    expect(mapped.shipTo.name).toBe("John Doe");
    expect(mapped.shipTo.address1).toBe("456 Oak Ave");
    expect(mapped.shipTo.city).toBe("Shelbyville");
    expect(mapped.shipTo.state).toBe("IL");
    expect(mapped.shipTo.zip).toBe("62565");
    expect(mapped.shipTo.country).toBe("US");
  });

  it("falls back to billing address when shipping is empty", () => {
    const orderNoShipping = {
      ...sampleWcOrder,
      shipping: {
        first_name: "",
        last_name: "",
        address_1: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      },
    };
    const mapped = adapter.mapOrder(orderNoShipping);
    expect(mapped.shipTo.name).toBe("John Doe");
    expect(mapped.shipTo.address1).toBe("123 Main St");
    expect(mapped.shipTo.city).toBe("Springfield");
    expect(mapped.shipTo.zip).toBe("62704");
  });

  it("maps billing email and phone to shipTo", () => {
    const mapped = adapter.mapOrder(sampleWcOrder);
    expect(mapped.shipTo.email).toBe("john@example.com");
    expect(mapped.shipTo.phone).toBe("555-0100");
  });

  it("maps line items with SKU, quantity, and price", () => {
    const mapped = adapter.mapOrder(sampleWcOrder);
    expect(mapped.lineItems).toHaveLength(2);

    const item1 = mapped.lineItems[0];
    expect(item1.externalLineId).toBe("101");
    expect(item1.sku).toBe("WGT-A");
    expect(item1.name).toBe("Widget A");
    expect(item1.quantity).toBe(3);
    expect(item1.unitPrice).toBe(19.99);
    expect(item1.imageUrl).toBe("https://store.example.com/widget-a.jpg");

    const item2 = mapped.lineItems[1];
    expect(item2.sku).toBe("GDG-B");
    expect(item2.quantity).toBe(1);
    expect(item2.unitPrice).toBe(49.5);
    expect(item2.imageUrl).toBeUndefined();
  });

  it("maps shipping method and customer notes", () => {
    const mapped = adapter.mapOrder(sampleWcOrder);
    expect(mapped.shippingMethod).toBe("Flat Rate");
    expect(mapped.notes).toBe("Leave at front door");
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = { id: 1, line_items: [] };
    const mapped = adapter.mapOrder(minimal);
    expect(mapped.externalId).toBe("1");
    expect(mapped.lineItems).toHaveLength(0);
    expect(mapped.shipTo.name).toBe("");
    expect(mapped.shippingMethod).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
  });
});

// ─── Status mapping tests ─────────────────────────────────────────────────────

describe("WooCommerce status mapping", () => {
  let mapWcStatus: typeof import("@/lib/integrations/marketplaces/woocommerce").mapWcStatus;

  beforeAll(async () => {
    const mod = await import("@/lib/integrations/marketplaces/woocommerce");
    mapWcStatus = mod.mapWcStatus;
  });

  it("maps processing → pending", () => {
    expect(mapWcStatus("processing")).toBe("pending");
  });

  it("maps on-hold → pending", () => {
    expect(mapWcStatus("on-hold")).toBe("pending");
  });

  it("maps completed → shipped", () => {
    expect(mapWcStatus("completed")).toBe("shipped");
  });

  it("maps cancelled → cancelled", () => {
    expect(mapWcStatus("cancelled")).toBe("cancelled");
  });

  it("maps refunded → cancelled", () => {
    expect(mapWcStatus("refunded")).toBe("cancelled");
  });

  it("defaults unknown statuses to pending", () => {
    expect(mapWcStatus("some-custom-status")).toBe("pending");
  });
});

// ─── Webhook signature verification tests ─────────────────────────────────────

function makeWcRequest(body: string, secret: string | null, topic = "order.created"): NextRequest {
  const sig = secret
    ? crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
    : "bad-signature";

  return new NextRequest("http://localhost/api/webhooks/woocommerce", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-wc-webhook-signature": sig,
      "x-wc-webhook-topic": topic,
      "x-wc-webhook-source": "https://store.example.com",
    },
    body,
  });
}

describe("WooCommerce webhook — fail-closed signature verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 401 when WOOCOMMERCE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    const res = await POST(makeWcRequest("{}", null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "real-secret";
    const req = new NextRequest("http://localhost/api/webhooks/woocommerce", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": "not-valid",
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-source": "https://store.example.com",
      },
      body: "{}",
    });
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature uses wrong secret", async () => {
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "real-secret";
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    const res = await POST(makeWcRequest("{}", "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("does not return 401 when signature is valid", async () => {
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "real-secret";
    const body = JSON.stringify({ id: 1, line_items: [] });
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    const res = await POST(makeWcRequest(body, "real-secret", "order.created"));
    expect(res.status).not.toBe(401);
  });
});
