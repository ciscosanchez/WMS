/**
 * @jest-environment node
 */

// WooCommerce adapter: order mapping, status mapping, webhook signature verification
import crypto from "crypto";
import { NextRequest } from "next/server";

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
    { id: 102, name: "Gadget B", sku: "GDG-B", quantity: 1, price: "49.50", image: null },
  ],
  shipping_lines: [{ method_title: "Flat Rate" }],
  customer_note: "Leave at front door",
};

describe("WooCommerceAdapter.mapOrder", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;
  beforeAll(async () => {
    const { WooCommerceAdapter } = await import("@/lib/integrations/marketplaces/woocommerce");
    adapter = new WooCommerceAdapter({
      storeUrl: "https://store.example.com",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
    });
  });

  it("maps basic order fields", () => {
    const m = adapter.mapOrder(sampleWcOrder);
    expect(m.externalId).toBe("727");
    expect(m.orderNumber).toBe("#727");
    expect(m.channel).toBe("WooCommerce");
    expect(m.priority).toBe("standard");
    expect(m.orderDate).toBeInstanceOf(Date);
  });

  it("maps shipping address (prefers shipping over billing)", () => {
    const m = adapter.mapOrder(sampleWcOrder);
    expect(m.shipTo.name).toBe("John Doe");
    expect(m.shipTo.address1).toBe("456 Oak Ave");
    expect(m.shipTo.city).toBe("Shelbyville");
    expect(m.shipTo.state).toBe("IL");
    expect(m.shipTo.zip).toBe("62565");
    expect(m.shipTo.country).toBe("US");
  });

  it("falls back to billing address when shipping is empty", () => {
    const o = {
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
    const m = adapter.mapOrder(o);
    expect(m.shipTo.name).toBe("John Doe");
    expect(m.shipTo.address1).toBe("123 Main St");
    expect(m.shipTo.city).toBe("Springfield");
    expect(m.shipTo.zip).toBe("62704");
  });

  it("maps billing email and phone to shipTo", () => {
    const m = adapter.mapOrder(sampleWcOrder);
    expect(m.shipTo.email).toBe("john@example.com");
    expect(m.shipTo.phone).toBe("555-0100");
  });

  it("maps line items with SKU, quantity, price, and image", () => {
    const m = adapter.mapOrder(sampleWcOrder);
    expect(m.lineItems).toHaveLength(2);
    expect(m.lineItems[0]).toMatchObject({
      externalLineId: "101",
      sku: "WGT-A",
      name: "Widget A",
      quantity: 3,
      unitPrice: 19.99,
      imageUrl: "https://store.example.com/widget-a.jpg",
    });
    expect(m.lineItems[1]).toMatchObject({ sku: "GDG-B", quantity: 1, unitPrice: 49.5 });
    expect(m.lineItems[1].imageUrl).toBeUndefined();
  });

  it("maps shipping method and customer notes", () => {
    const m = adapter.mapOrder(sampleWcOrder);
    expect(m.shippingMethod).toBe("Flat Rate");
    expect(m.notes).toBe("Leave at front door");
  });

  it("handles missing optional fields gracefully", () => {
    const m = adapter.mapOrder({ id: 1, line_items: [] });
    expect(m.externalId).toBe("1");
    expect(m.lineItems).toHaveLength(0);
    expect(m.shipTo.name).toBe("");
    expect(m.shippingMethod).toBeUndefined();
  });
});

describe("WooCommerce status mapping", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapWcStatus: any;
  beforeAll(async () => {
    mapWcStatus = (await import("@/lib/integrations/marketplaces/woocommerce")).mapWcStatus;
  });

  it.each([
    ["processing", "pending"],
    ["on-hold", "pending"],
    ["completed", "shipped"],
    ["cancelled", "cancelled"],
    ["refunded", "cancelled"],
    ["custom-status", "pending"],
  ])("maps %s → %s", (wc, internal) => {
    expect(mapWcStatus(wc)).toBe(internal);
  });
});

function makeWcRequest(body: string, secret: string | null, topic = "order.created"): NextRequest {
  const sig = secret
    ? crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
    : "bad";
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

describe("WooCommerce webhook — signature verification", () => {
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
    expect((await POST(makeWcRequest("{}", null))).status).toBe(401);
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
    expect((await POST(req)).status).toBe(401);
  });

  it("returns 401 when signature uses wrong secret", async () => {
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "real-secret";
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    expect((await POST(makeWcRequest("{}", "wrong-secret"))).status).toBe(401);
  });

  it("does not return 401 when signature is valid", async () => {
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "real-secret";
    const { POST } = await import("@/app/api/webhooks/woocommerce/route");
    const res = await POST(makeWcRequest(JSON.stringify({ id: 1, line_items: [] }), "real-secret"));
    expect(res.status).not.toBe(401);
  });
});
