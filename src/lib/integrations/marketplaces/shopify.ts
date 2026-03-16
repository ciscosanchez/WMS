/**
 * Shopify Marketplace Adapter
 *
 * Connects to Shopify Admin API (REST or GraphQL) to:
 * - Import orders into WMS
 * - Sync inventory levels back to Shopify
 * - Push tracking/fulfillment info
 *
 * API Docs: https://shopify.dev/docs/api/admin-rest
 * Auth: OAuth 2.0 or custom app access token
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface ShopifyConfig {
  shopDomain: string; // e.g., "acme-store.myshopify.com"
  accessToken: string; // Admin API access token
  apiVersion: string; // e.g., "2024-10"
  locationId?: string; // Shopify location ID for inventory
}

export class ShopifyAdapter implements MarketplaceAdapter {
  channelName = "Shopify";
  private config: ShopifyConfig;
  private baseUrl: string;

  constructor(config: ShopifyConfig) {
    this.config = config;
    this.baseUrl = `https://${config.shopDomain}/admin/api/${config.apiVersion}`;
  }

  /**
   * Fetch orders from Shopify
   * GET /admin/api/2024-10/orders.json?status=any&updated_at_min={since}
   */
  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    // TODO: Replace with real Shopify API call
    // const res = await fetch(`${this.baseUrl}/orders.json?status=unfulfilled&updated_at_min=${since.toISOString()}`, {
    //   headers: { "X-Shopify-Access-Token": this.config.accessToken }
    // });
    // const data = await res.json();

    // Mock response
    return [
      {
        externalId: "SH-5001",
        orderNumber: "#1001",
        channel: "Shopify",
        orderDate: new Date(),
        shipByDate: new Date(Date.now() + 2 * 86400000),
        priority: "standard",
        shipTo: {
          name: "Jane Cooper",
          address1: "789 Oak Ave",
          city: "Austin",
          state: "TX",
          zip: "78701",
          country: "US",
          email: "jane@example.com",
        },
        lineItems: [
          {
            externalLineId: "li-1001",
            sku: "WIDGET-001",
            name: "Standard Widget",
            quantity: 2,
            unitPrice: 29.99,
          },
        ],
        shippingMethod: "Standard",
      },
    ];
  }

  /**
   * Sync inventory levels to Shopify
   * POST /admin/api/2024-10/inventory_levels/set.json
   * { location_id, inventory_item_id, available }
   */
  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    // TODO: Replace with real Shopify API calls
    // for (const update of updates) {
    //   // First: look up inventory_item_id from SKU via products endpoint
    //   // Then: POST inventory_levels/set.json
    //   await fetch(`${this.baseUrl}/inventory_levels/set.json`, {
    //     method: "POST",
    //     headers: {
    //       "X-Shopify-Access-Token": this.config.accessToken,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       location_id: this.config.locationId,
    //       inventory_item_id: "lookup-from-sku",
    //       available: update.availableQuantity,
    //     }),
    //   });
    // }
  }

  /**
   * Push fulfillment to Shopify
   * POST /admin/api/2024-10/orders/{order_id}/fulfillments.json
   */
  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    // TODO: Replace with real Shopify API call
    // await fetch(`${this.baseUrl}/orders/${update.externalOrderId}/fulfillments.json`, {
    //   method: "POST",
    //   headers: {
    //     "X-Shopify-Access-Token": this.config.accessToken,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     fulfillment: {
    //       tracking_number: update.trackingNumber,
    //       tracking_company: update.carrier,
    //       line_items: update.lineItems.map(li => ({
    //         id: li.externalLineId,
    //         quantity: li.quantity,
    //       })),
    //     },
    //   }),
    // });
  }

  /**
   * Test connection to Shopify
   * GET /admin/api/2024-10/shop.json
   */
  async testConnection(): Promise<boolean> {
    try {
      // TODO: Replace with real API call
      // const res = await fetch(`${this.baseUrl}/shop.json`, {
      //   headers: { "X-Shopify-Access-Token": this.config.accessToken }
      // });
      // return res.ok;
      return true; // Mock success
    } catch {
      return false;
    }
  }
}
