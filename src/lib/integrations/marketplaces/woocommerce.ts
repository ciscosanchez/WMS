/**
 * WooCommerce Marketplace Adapter
 *
 * Connects to WooCommerce REST API v3 to:
 * - Import orders into WMS
 * - Push tracking/fulfillment info when orders ship
 * - Sync inventory levels back to WooCommerce
 *
 * API Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const WC_STATUS_MAP: Record<string, string> = {
  processing: "pending",
  "on-hold": "pending",
  completed: "shipped",
  cancelled: "cancelled",
  refunded: "cancelled",
  failed: "cancelled",
};

export function mapWcStatus(wcStatus: string): string {
  return WC_STATUS_MAP[wcStatus] ?? "pending";
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class WooCommerceAdapter implements MarketplaceAdapter {
  channelName = "WooCommerce";
  private config: WooCommerceConfig;
  private baseUrl: string;

  constructor(config: WooCommerceConfig) {
    this.config = config;
    // Normalise trailing slash
    const url = config.storeUrl.replace(/\/+$/, "");
    this.baseUrl = `${url}/wp-json/wc/v3`;
  }

  private headers(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString("base64");
    return {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    };
  }

  private async wcFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`WooCommerce API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // ─── Fetch orders ──────────────────────────────────────────────────────────

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const params = new URLSearchParams({
      after: since.toISOString(),
      per_page: "100",
      orderby: "date",
      order: "desc",
    });

    const data = await this.wcFetch(`/orders?${params}`);
    const orders: MarketplaceOrder[] = (Array.isArray(data) ? data : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => this.mapOrder(o)
    );
    return orders;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapOrder(o: any): MarketplaceOrder {
    const shipping = o.shipping ?? {};
    const billing = o.billing ?? {};

    // Prefer shipping address; fall back to billing
    const name =
      [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") ||
      [billing.first_name, billing.last_name].filter(Boolean).join(" ");

    return {
      externalId: String(o.id),
      orderNumber: o.number ? `#${o.number}` : String(o.id),
      channel: "WooCommerce",
      orderDate: new Date(o.date_created ?? o.date_created_gmt ?? Date.now()),
      priority: "standard",
      shipTo: {
        name,
        address1: shipping.address_1 || billing.address_1 || "",
        address2: shipping.address_2 || billing.address_2 || undefined,
        city: shipping.city || billing.city || "",
        state: shipping.state || billing.state || "",
        zip: shipping.postcode || billing.postcode || "",
        country: shipping.country || billing.country || "US",
        phone: billing.phone || shipping.phone || undefined,
        email: billing.email || undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineItems: (o.line_items ?? []).map((li: any) => ({
        externalLineId: String(li.id),
        sku: li.sku ?? "",
        name: li.name ?? "",
        quantity: li.quantity ?? 1,
        unitPrice: parseFloat(li.price ?? li.total ?? "0"),
        weightGrams: undefined,
        imageUrl: li.image?.src ?? undefined,
      })),
      shippingMethod: o.shipping_lines?.[0]?.method_title ?? undefined,
      notes: o.customer_note ?? undefined,
    };
  }

  // ─── Push fulfillment ──────────────────────────────────────────────────────

  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    // Update order status to completed and add tracking note
    await this.wcFetch(`/orders/${update.externalOrderId}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "completed",
      }),
    });

    // Add tracking info as an order note
    if (update.trackingNumber) {
      const noteText = `Shipped via ${update.carrier}. Tracking: ${update.trackingNumber}`;
      await this.wcFetch(`/orders/${update.externalOrderId}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note: noteText,
          customer_note: true,
        }),
      });
    }
  }

  // ─── Sync inventory ────────────────────────────────────────────────────────

  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    // Resolve SKUs to WooCommerce product/variation IDs
    for (const update of updates) {
      const products = await this.wcFetch(
        `/products?sku=${encodeURIComponent(update.sku)}&per_page=1`
      );
      if (!Array.isArray(products) || products.length === 0) continue;

      const product = products[0];
      await this.wcFetch(`/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          stock_quantity: update.availableQuantity,
          manage_stock: true,
        }),
      });
    }
  }

  // ─── Connection test ───────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.wcFetch("/system_status");
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Tenant-scoped factory (preferred) ───────────────────────────────────────

/**
 * Create a WooCommerceAdapter from explicit credentials (resolved from tenant DB).
 */
export function getWooCommerceAdapterForTenant(opts: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): WooCommerceAdapter {
  return new WooCommerceAdapter({
    storeUrl: opts.storeUrl,
    consumerKey: opts.consumerKey,
    consumerSecret: opts.consumerSecret,
  });
}

// ─── Legacy factory using env vars (backward compat) ─────────────────────────

export function getWooCommerceAdapter(): WooCommerceAdapter {
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL;
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!storeUrl || !consumerKey || !consumerSecret) {
    throw new Error(
      "WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET must be set to use WooCommerce integration"
    );
  }

  return new WooCommerceAdapter({ storeUrl, consumerKey, consumerSecret });
}
