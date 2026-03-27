/**
 * BigCommerce Marketplace Adapter Tests
 */

import { BigCommerceAdapter } from "@/lib/integrations/marketplaces/bigcommerce";
import type { MarketplaceOrder } from "@/lib/integrations/marketplaces/types";

type BigCommerceAdapterWithMapOrder = {
  mapOrder: (order: unknown) => MarketplaceOrder;
};

function createTestAdapter() {
  return new BigCommerceAdapter({
    storeHash: "test-store-hash",
    accessToken: "test-access-token",
  });
}

describe("BigCommerceAdapter", () => {
  it("has correct channel name", () => {
    const adapter = createTestAdapter();
    expect(adapter.channelName).toBe("BigCommerce");
  });

  it("maps BigCommerce order to MarketplaceOrder format", () => {
    const adapter = createTestAdapter();
    const mapOrder = (adapter as unknown as BigCommerceAdapterWithMapOrder).mapOrder.bind(adapter);

    const bcOrder = {
      id: 12345,
      date_created: "2026-03-24T10:00:00Z",
      billing_address: {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane@example.com",
      },
      shipping_addresses: [
        {
          first_name: "Jane",
          last_name: "Smith",
          street_1: "456 Oak Ave",
          street_2: "Suite 100",
          city: "Portland",
          state: "OR",
          zip: "97201",
          country_iso2: "US",
          phone: "503-555-6789",
        },
      ],
      products: [
        {
          id: 1,
          sku: "WIDGET-BC-001",
          name: "Widget BC",
          quantity: 2,
          base_price: "29.99",
        },
      ],
      shipping_method: "USPS Priority",
    };

    const mapped = mapOrder(bcOrder);

    expect(mapped.externalId).toBe("12345");
    expect(mapped.orderNumber).toBe("BC-12345");
    expect(mapped.channel).toBe("BigCommerce");
    expect(mapped.shipTo.name).toBe("Jane Smith");
    expect(mapped.shipTo.address1).toBe("456 Oak Ave");
    expect(mapped.shipTo.address2).toBe("Suite 100");
    expect(mapped.shipTo.city).toBe("Portland");
    expect(mapped.shipTo.state).toBe("OR");
    expect(mapped.shipTo.zip).toBe("97201");
    expect(mapped.lineItems).toHaveLength(1);
    expect(mapped.lineItems[0].sku).toBe("WIDGET-BC-001");
    expect(mapped.lineItems[0].quantity).toBe(2);
    expect(mapped.lineItems[0].unitPrice).toBe(29.99);
    expect(mapped.shippingMethod).toBe("USPS Priority");
  });

  it("handles missing address fields", () => {
    const adapter = createTestAdapter();
    const mapOrder = (adapter as unknown as BigCommerceAdapterWithMapOrder).mapOrder.bind(adapter);

    const minimalOrder = {
      id: 99,
      date_created: "2026-03-24T10:00:00Z",
      billing_address: {},
      products: [],
    };

    const mapped = mapOrder(minimalOrder);
    expect(mapped.externalId).toBe("99");
    expect(mapped.shipTo.name).toBe("");
    expect(mapped.lineItems).toHaveLength(0);
  });

  it("testConnection returns false without real credentials", async () => {
    const adapter = createTestAdapter();
    const result = await adapter.testConnection();
    expect(result).toBe(false);
  });
});
