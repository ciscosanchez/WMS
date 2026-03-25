/**
 * @jest-environment node
 */

// eBay adapter: order mapping, status mapping, webhook signature verification

const sampleEbayOrder = {
  orderId: "12-34567-89012",
  legacyOrderId: "110451234567",
  creationDate: "2026-03-20T14:30:00.000Z",
  orderFulfillmentStatus: "AWAITING_SHIPMENT",
  orderPaymentStatus: "PAID",
  buyer: { buyerRegistrationAddress: { email: "buyer@example.com" } },
  fulfillmentStartInstructions: [
    {
      shippingStep: {
        shipTo: {
          fullName: "Jane Smith",
          contactAddress: {
            addressLine1: "789 Elm St",
            addressLine2: "Suite 100",
            city: "Portland",
            stateOrProvince: "OR",
            postalCode: "97201",
            countryCode: "US",
          },
          primaryPhone: { phoneNumber: "503-555-0199" },
        },
        shippingServiceCode: "USPS_Priority",
      },
    },
  ],
  lineItems: [
    {
      lineItemId: "LI-001",
      title: "Vintage Clock",
      sku: "CLK-VTG-01",
      quantity: 2,
      lineItemCost: { value: "34.99", currency: "USD" },
      image: { imageUrl: "https://ebay.example.com/clock.jpg" },
    },
    {
      lineItemId: "LI-002",
      title: "Brass Compass",
      sku: "CMP-BRS-01",
      quantity: 1,
      lineItemCost: { value: "22.50", currency: "USD" },
      image: null,
    },
  ],
  buyerCheckoutNotes: "Gift wrap please",
};

describe("EbayAdapter.mapOrder", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;
  beforeAll(async () => {
    const { EbayAdapter } = await import("@/lib/integrations/marketplaces/ebay");
    adapter = new EbayAdapter({
      appId: "test-app",
      certId: "test-cert",
      devId: "test-dev",
      userToken: "test-token",
      sandbox: true,
    });
  });

  it("maps basic order fields", () => {
    const m = adapter.mapOrder(sampleEbayOrder);
    expect(m.externalId).toBe("12-34567-89012");
    expect(m.orderNumber).toBe("110451234567");
    expect(m.channel).toBe("eBay");
    expect(m.priority).toBe("standard");
    expect(m.orderDate).toBeInstanceOf(Date);
  });

  it("maps shipping address from fulfillmentStartInstructions", () => {
    const m = adapter.mapOrder(sampleEbayOrder);
    expect(m.shipTo.name).toBe("Jane Smith");
    expect(m.shipTo.address1).toBe("789 Elm St");
    expect(m.shipTo.address2).toBe("Suite 100");
    expect(m.shipTo.city).toBe("Portland");
    expect(m.shipTo.state).toBe("OR");
    expect(m.shipTo.zip).toBe("97201");
    expect(m.shipTo.country).toBe("US");
  });

  it("maps buyer email and phone", () => {
    const m = adapter.mapOrder(sampleEbayOrder);
    expect(m.shipTo.email).toBe("buyer@example.com");
    expect(m.shipTo.phone).toBe("503-555-0199");
  });

  it("maps line items with SKU, quantity, price, and image", () => {
    const m = adapter.mapOrder(sampleEbayOrder);
    expect(m.lineItems).toHaveLength(2);
    expect(m.lineItems[0]).toMatchObject({
      externalLineId: "LI-001",
      sku: "CLK-VTG-01",
      name: "Vintage Clock",
      quantity: 2,
      unitPrice: 34.99,
      imageUrl: "https://ebay.example.com/clock.jpg",
    });
    expect(m.lineItems[1]).toMatchObject({
      sku: "CMP-BRS-01",
      quantity: 1,
      unitPrice: 22.5,
    });
    expect(m.lineItems[1].imageUrl).toBeUndefined();
  });

  it("maps shipping method and buyer notes", () => {
    const m = adapter.mapOrder(sampleEbayOrder);
    expect(m.shippingMethod).toBe("USPS_Priority");
    expect(m.notes).toBe("Gift wrap please");
  });

  it("handles missing optional fields gracefully", () => {
    const m = adapter.mapOrder({ orderId: "EMPTY-001", lineItems: [] });
    expect(m.externalId).toBe("EMPTY-001");
    expect(m.lineItems).toHaveLength(0);
    expect(m.shipTo.name).toBe("");
    expect(m.shippingMethod).toBeUndefined();
    expect(m.notes).toBeUndefined();
  });

  it("handles order with no fulfillmentStartInstructions", () => {
    const m = adapter.mapOrder({
      orderId: "NO-SHIP-001",
      lineItems: [
        {
          lineItemId: "X",
          title: "Test",
          sku: "TST",
          quantity: 1,
          lineItemCost: { value: "10.00" },
        },
      ],
    });
    expect(m.shipTo.address1).toBe("");
    expect(m.lineItems).toHaveLength(1);
  });
});

describe("eBay status mapping", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapEbayStatus: any;
  beforeAll(async () => {
    mapEbayStatus = (await import("@/lib/integrations/marketplaces/ebay")).mapEbayStatus;
  });

  it.each([
    ["AWAITING_PAYMENT", "pending"],
    ["PAID", "pending"],
    ["AWAITING_SHIPMENT", "pending"],
    ["SHIPPED", "shipped"],
    ["DELIVERED", "shipped"],
    ["CANCELLED", "cancelled"],
    ["REFUNDED", "cancelled"],
    ["UNKNOWN_STATUS", "pending"],
  ])("maps %s → %s", (ebay, internal) => {
    expect(mapEbayStatus(ebay)).toBe(internal);
  });
});

describe("EbayAdapter constructor", () => {
  it.each([true, false])("constructs with sandbox=%s", (sandbox) => {
    const { EbayAdapter } = require("@/lib/integrations/marketplaces/ebay");
    const adapter = new EbayAdapter({
      appId: "app",
      certId: "cert",
      devId: "dev",
      userToken: "tok",
      sandbox,
    });
    expect(adapter.channelName).toBe("eBay");
  });
});

describe("getEbayAdapter factory", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when required env vars are missing", async () => {
    delete process.env.EBAY_APP_ID;
    delete process.env.EBAY_CERT_ID;
    delete process.env.EBAY_DEV_ID;
    const { getEbayAdapter } = await import("@/lib/integrations/marketplaces/ebay");
    expect(() => getEbayAdapter()).toThrow("EBAY_APP_ID");
  });

  it("creates adapter when env vars are set", async () => {
    process.env.EBAY_APP_ID = "app";
    process.env.EBAY_CERT_ID = "cert";
    process.env.EBAY_DEV_ID = "dev";
    process.env.EBAY_USER_TOKEN = "tok";
    process.env.EBAY_SANDBOX = "true";
    const { getEbayAdapter } = await import("@/lib/integrations/marketplaces/ebay");
    const adapter = getEbayAdapter();
    expect(adapter.channelName).toBe("eBay");
  });
});
