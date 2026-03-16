/**
 * Amazon Marketplace Adapter (SP-API)
 *
 * Connects to Amazon Selling Partner API to:
 * - Import orders (Orders API)
 * - Sync inventory (FBA Inventory API or Merchant Fulfillment)
 * - Push tracking (Feeds API)
 *
 * API Docs: https://developer-docs.amazon.com/sp-api/
 * Auth: LWA (Login with Amazon) OAuth 2.0
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface AmazonConfig {
  sellerId: string;
  marketplaceId: string; // e.g., ATVPDKIKX0DER (US)
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  region: "us-east-1" | "eu-west-1" | "us-west-2";
}

export class AmazonAdapter implements MarketplaceAdapter {
  channelName = "Amazon";
  private config: AmazonConfig;

  constructor(config: AmazonConfig) {
    this.config = config;
  }

  /**
   * Fetch orders from Amazon SP-API
   * GET /orders/v0/orders?MarketplaceIds={id}&CreatedAfter={since}
   */
  async fetchOrders(_since: Date): Promise<MarketplaceOrder[]> {
    // TODO: Implement SP-API OAuth token refresh + order fetch
    // Step 1: Exchange refresh token for access token via LWA
    // Step 2: GET /orders/v0/orders with SigV4 signing
    // Step 3: For each order, GET /orders/v0/orders/{orderId}/orderItems

    return [
      {
        externalId: "AMZ-114-2026",
        orderNumber: "114-7829364-2026",
        channel: "Amazon",
        orderDate: new Date(),
        shipByDate: new Date(Date.now() + 2 * 86400000),
        priority: "standard",
        shipTo: {
          name: "Robert Fox",
          address1: "456 Pine St",
          city: "Denver",
          state: "CO",
          zip: "80202",
          country: "US",
        },
        lineItems: [
          {
            externalLineId: "amz-li-001",
            sku: "GADGET-001",
            name: "Premium Gadget",
            quantity: 1,
            unitPrice: 49.99,
          },
        ],
        shippingMethod: "Standard",
      },
    ];
  }

  /**
   * Sync inventory to Amazon
   * POST /feeds/2021-06-30/feeds (JSON_LISTINGS_FEED)
   */
  async syncInventory(_updates: InventoryUpdate[]): Promise<void> {
    // TODO: Create inventory feed document, submit via Feeds API
    // Feed type: JSON_LISTINGS_FEED
    // Each update: { sku, fulfillment_availability: [{ quantity }] }
  }

  /**
   * Push fulfillment/tracking to Amazon
   * POST /feeds/2021-06-30/feeds (POST_ORDER_FULFILLMENT_DATA)
   */
  async pushFulfillment(_update: FulfillmentUpdate): Promise<void> {
    // TODO: Create order fulfillment feed
    // Feed type: POST_ORDER_FULFILLMENT_DATA
    // Include: order ID, tracking number, carrier code, ship date
  }

  async testConnection(): Promise<boolean> {
    try {
      // TODO: GET /sellers/v1/marketplaceParticipations
      return true;
    } catch {
      return false;
    }
  }
}
