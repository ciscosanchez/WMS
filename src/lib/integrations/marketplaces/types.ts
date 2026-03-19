/**
 * Marketplace Integration Types
 *
 * Unified types for multi-channel order management.
 * Each marketplace adapter (Shopify, Amazon, Walmart) implements MarketplaceAdapter.
 */

export interface MarketplaceOrder {
  externalId: string;
  orderNumber: string;
  channel: string;
  orderDate: Date;
  shipByDate?: Date;
  priority: "standard" | "expedited" | "rush" | "same_day";
  shipTo: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
  };
  lineItems: Array<{
    externalLineId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    // Enrichment fields — populated when available from the marketplace
    weightGrams?: number;
    imageUrl?: string;
    vendor?: string;
    variantTitle?: string;
  }>;
  shippingMethod?: string;
  notes?: string;
}

export interface InventoryUpdate {
  sku: string;
  availableQuantity: number;
  locationId?: string;
}

export interface FulfillmentUpdate {
  externalOrderId: string;
  trackingNumber: string;
  carrier: string;
  service?: string;
  shippedAt: Date;
  lineItems?: Array<{
    externalLineId: string;
    quantity: number;
  }>;
}

/**
 * All marketplace adapters implement this interface.
 */
export interface MarketplaceAdapter {
  channelName: string;

  /** Fetch new/updated orders from the marketplace */
  fetchOrders(since: Date): Promise<MarketplaceOrder[]>;

  /** Push inventory quantities to the marketplace */
  syncInventory(updates: InventoryUpdate[]): Promise<void>;

  /** Push fulfillment/tracking info to the marketplace */
  pushFulfillment(update: FulfillmentUpdate): Promise<void>;

  /** Test the connection / credentials */
  testConnection(): Promise<boolean>;
}
