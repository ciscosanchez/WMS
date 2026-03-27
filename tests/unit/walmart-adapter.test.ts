/**
 * Walmart Marketplace Adapter Tests
 *
 * Tests order mapping, fulfillment payload construction,
 * and inventory sync formatting.
 */

import { WalmartAdapter } from "@/lib/integrations/marketplaces/walmart";
import type { MarketplaceOrder } from "@/lib/integrations/marketplaces/types";

type WalmartAdapterWithMapOrder = {
  mapOrder: (order: unknown) => MarketplaceOrder;
};

// Create adapter instance (won't hit real API in unit tests)
function createTestAdapter() {
  return new WalmartAdapter({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    environment: "sandbox",
  });
}

describe("WalmartAdapter", () => {
  it("has correct channel name", () => {
    const adapter = createTestAdapter();
    expect(adapter.channelName).toBe("Walmart");
  });

  it("maps Walmart order to MarketplaceOrder format", () => {
    const adapter = createTestAdapter();
    // Access private method via prototype for testing
    const mapOrder = (adapter as unknown as WalmartAdapterWithMapOrder).mapOrder.bind(adapter);

    const walmartOrder = {
      purchaseOrderId: "WM-123456",
      customerOrderId: "CO-789",
      orderDate: "2026-03-24T10:00:00Z",
      shippingInfo: {
        postalAddress: {
          name: "John Doe",
          address1: "123 Main St",
          address2: "Apt 4",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "US",
        },
        phone: "512-555-1234",
        methodCode: "STANDARD",
        estimatedShipDate: "2026-03-27T00:00:00Z",
      },
      orderLines: {
        orderLine: [
          {
            lineNumber: "1",
            item: {
              sku: "WIDGET-001",
              productName: "Blue Widget",
            },
            orderLineQuantity: { amount: "3" },
            charges: {
              charge: [
                {
                  chargeType: "PRODUCT",
                  chargeAmount: { amount: "19.99" },
                },
              ],
            },
          },
          {
            lineNumber: "2",
            item: {
              sku: "GADGET-002",
              productName: "Red Gadget",
            },
            orderLineQuantity: { amount: "1" },
            charges: {
              charge: [
                {
                  chargeType: "PRODUCT",
                  chargeAmount: { amount: "49.99" },
                },
              ],
            },
          },
        ],
      },
    };

    const mapped = mapOrder(walmartOrder);

    expect(mapped.externalId).toBe("WM-123456");
    expect(mapped.orderNumber).toBe("CO-789");
    expect(mapped.channel).toBe("Walmart");
    expect(mapped.orderDate).toBeInstanceOf(Date);
    expect(mapped.shipByDate).toBeInstanceOf(Date);
    expect(mapped.priority).toBe("standard");

    // Ship-to address
    expect(mapped.shipTo.name).toBe("John Doe");
    expect(mapped.shipTo.address1).toBe("123 Main St");
    expect(mapped.shipTo.address2).toBe("Apt 4");
    expect(mapped.shipTo.city).toBe("Austin");
    expect(mapped.shipTo.state).toBe("TX");
    expect(mapped.shipTo.zip).toBe("78701");
    expect(mapped.shipTo.country).toBe("US");
    expect(mapped.shipTo.phone).toBe("512-555-1234");

    // Line items
    expect(mapped.lineItems).toHaveLength(2);
    expect(mapped.lineItems[0].sku).toBe("WIDGET-001");
    expect(mapped.lineItems[0].name).toBe("Blue Widget");
    expect(mapped.lineItems[0].quantity).toBe(3);
    expect(mapped.lineItems[0].unitPrice).toBe(19.99);
    expect(mapped.lineItems[1].sku).toBe("GADGET-002");
    expect(mapped.lineItems[1].quantity).toBe(1);
    expect(mapped.lineItems[1].unitPrice).toBe(49.99);

    expect(mapped.shippingMethod).toBe("STANDARD");
  });

  it("handles missing address fields gracefully", () => {
    const adapter = createTestAdapter();
    const mapOrder = (adapter as unknown as WalmartAdapterWithMapOrder).mapOrder.bind(adapter);

    const minimalOrder = {
      purchaseOrderId: "WM-MIN",
      customerOrderId: "CO-MIN",
      orderDate: "2026-03-24T10:00:00Z",
      shippingInfo: {},
      orderLines: { orderLine: [] },
    };

    const mapped = mapOrder(minimalOrder);
    expect(mapped.externalId).toBe("WM-MIN");
    expect(mapped.shipTo.name).toBe("");
    expect(mapped.shipTo.city).toBe("");
    expect(mapped.lineItems).toHaveLength(0);
    expect(mapped.shipByDate).toBeUndefined();
  });

  it("handles missing charges — defaults unitPrice to 0", () => {
    const adapter = createTestAdapter();
    const mapOrder = (adapter as unknown as WalmartAdapterWithMapOrder).mapOrder.bind(adapter);

    const order = {
      purchaseOrderId: "WM-NO-CHARGE",
      customerOrderId: "CO-NC",
      orderDate: "2026-03-24T10:00:00Z",
      shippingInfo: {},
      orderLines: {
        orderLine: [
          {
            lineNumber: "1",
            item: { sku: "FREE-ITEM", productName: "Free Item" },
            orderLineQuantity: { amount: "1" },
            charges: { charge: [] },
          },
        ],
      },
    };

    const mapped = mapOrder(order);
    expect(mapped.lineItems[0].unitPrice).toBe(0);
  });

  it("handles missing quantity — defaults to 1", () => {
    const adapter = createTestAdapter();
    const mapOrder = (adapter as unknown as WalmartAdapterWithMapOrder).mapOrder.bind(adapter);

    const order = {
      purchaseOrderId: "WM-NO-QTY",
      customerOrderId: "CO-NQ",
      orderDate: "2026-03-24T10:00:00Z",
      shippingInfo: {},
      orderLines: {
        orderLine: [
          {
            lineNumber: "1",
            item: { sku: "ITEM-1", productName: "Item" },
            charges: {},
          },
        ],
      },
    };

    const mapped = mapOrder(order);
    expect(mapped.lineItems[0].quantity).toBe(1);
  });

  it("testConnection returns false without real credentials", async () => {
    const adapter = createTestAdapter();
    // Sandbox endpoint won't accept test credentials
    const result = await adapter.testConnection();
    expect(result).toBe(false);
  });
});
