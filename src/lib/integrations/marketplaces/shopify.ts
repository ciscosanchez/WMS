/**
 * Shopify Marketplace Adapter — real implementation
 *
 * Connects to Shopify Admin REST API to:
 * - Import unfulfilled orders into WMS
 * - Sync inventory levels back to Shopify
 * - Push tracking/fulfillment info when orders ship
 *
 * API Docs: https://shopify.dev/docs/api/admin-rest
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  locationId?: string;
}

type ShopifyFetchJson = {
  orders?: ShopifyOrderPayload[];
  fulfillment_orders?: Array<{ id: number; status?: string }>;
  products?: Array<{
    variants?: Array<{
      sku?: string;
      image_id?: number;
      inventory_item_id?: number;
    }>;
    image?: { src?: string };
    images?: Array<{ id: number; src?: string }>;
  }>;
  locations?: Array<{ id: number; active?: boolean }>;
};

type ShopifyShippingAddress = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province_code?: string;
  province?: string;
  zip?: string;
  country_code?: string;
  phone?: string;
};

type ShopifyShippingLine = { title?: string };

type ShopifyLineItem = {
  id: number | string;
  sku?: string;
  title?: string;
  quantity?: number;
  price?: string;
  grams?: number;
  image?: { src?: string };
  vendor?: string;
  variant_title?: string;
};

type ShopifyOrderPayload = {
  id: number | string;
  name: string;
  email?: string;
  created_at: string;
  shipping_address?: ShopifyShippingAddress;
  shipping_lines?: ShopifyShippingLine[];
  line_items?: ShopifyLineItem[];
  note?: string;
};

export class ShopifyAdapter implements MarketplaceAdapter {
  channelName = "Shopify";
  private config: ShopifyConfig;
  private baseUrl: string;

  constructor(config: ShopifyConfig) {
    this.config = config;
    this.baseUrl = `https://${config.shopDomain}/admin/api/${config.apiVersion}`;
  }

  private headers() {
    return {
      "X-Shopify-Access-Token": this.config.accessToken,
      "Content-Type": "application/json",
    };
  }

  private async shopifyFetch(path: string, init?: RequestInit): Promise<ShopifyFetchJson> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Shopify API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // ─── Fetch unfulfilled orders ───────────────────────────────────────────────

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const params = new URLSearchParams({
      status: "open",
      fulfillment_status: "unfulfilled",
      updated_at_min: since.toISOString(),
      limit: "250",
      fields: "id,name,email,created_at,shipping_address,line_items,shipping_lines,note,tags",
    });

    const data = await this.shopifyFetch(`/orders.json?${params}`);
    const orders: import("./types").MarketplaceOrder[] = (data.orders ?? []).map((o) =>
      this.mapOrder(o)
    );

    // Enrich line items with product images from the Products API
    await this.enrichLineItemImages(orders);

    return orders;
  }

  private mapOrder(o: ShopifyOrderPayload): MarketplaceOrder {
    const addr = o.shipping_address ?? {};
    const shippingLine = o.shipping_lines?.[0];
    return {
      externalId: String(o.id),
      orderNumber: o.name, // "#1001"
      channel: "Shopify",
      orderDate: new Date(o.created_at),
      priority: "standard",
      shipTo: {
        name: addr.name ?? "",
        address1: addr.address1 ?? "",
        address2: addr.address2 ?? undefined,
        city: addr.city ?? "",
        state: addr.province_code ?? addr.province ?? "",
        zip: addr.zip ?? "",
        country: addr.country_code ?? "US",
        phone: addr.phone ?? undefined,
        email: o.email ?? undefined,
      },
      lineItems: (o.line_items ?? []).map((li) => ({
        externalLineId: String(li.id),
        sku: li.sku ?? "",
        name: li.title ?? "",
        quantity: li.quantity ?? 1,
        unitPrice: parseFloat(li.price ?? "0"),
        weightGrams: li.grams ?? undefined,
        imageUrl: li.image?.src ?? undefined,
        vendor: li.vendor ?? undefined,
        variantTitle:
          li.variant_title && li.variant_title !== "Default Title" ? li.variant_title : undefined,
      })),
      shippingMethod: shippingLine?.title ?? undefined,
      notes: o.note ?? undefined,
    };
  }

  // ─── Push fulfillment (tracking) back to Shopify ───────────────────────────

  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    // Step 1: get fulfillment orders for this Shopify order
    const foData = await this.shopifyFetch(
      `/orders/${update.externalOrderId}/fulfillment_orders.json`
    );
    const fulfillmentOrders = foData.fulfillment_orders ?? [];
    const open = fulfillmentOrders.find((fulfillmentOrder) =>
      ["open", "in_progress"].includes(fulfillmentOrder.status ?? "")
    );
    if (!open) return; // Nothing to fulfill

    // Step 2: create fulfillment using Shopify's own FO line item IDs (not WMS IDs)
    // Omitting fulfillment_order_line_items fulfills all remaining items on the FO.
    await this.shopifyFetch("/fulfillments.json", {
      method: "POST",
      body: JSON.stringify({
        fulfillment: {
          line_items_by_fulfillment_order: [
            {
              fulfillment_order_id: open.id,
            },
          ],
          tracking_info: {
            number: update.trackingNumber,
            company: update.carrier,
          },
          notify_customer: true,
        },
      }),
    });
  }

  // ─── Sync inventory levels ──────────────────────────────────────────────────

  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    const locationId = await this.ensureLocationId();

    // Build SKU → inventory_item_id map by scanning variants
    const skus = updates.map((u) => u.sku);
    const skuToItemId = await this.resolveInventoryItemIds(skus);

    for (const update of updates) {
      const inventoryItemId = skuToItemId.get(update.sku);
      if (!inventoryItemId) continue; // SKU not in Shopify

      await this.shopifyFetch("/inventory_levels/set.json", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: update.availableQuantity,
        }),
      });
    }
  }

  // ─── Enrich line items with product images ──────────────────────────────────

  private async enrichLineItemImages(orders: import("./types").MarketplaceOrder[]): Promise<void> {
    // Collect all unique SKUs that don't already have an image
    const skusNeedingImage = new Set<string>();
    for (const order of orders) {
      for (const li of order.lineItems) {
        if (li.sku && !li.imageUrl) skusNeedingImage.add(li.sku);
      }
    }
    if (skusNeedingImage.size === 0) return;

    // Fetch products and build SKU → image map
    try {
      const data = await this.shopifyFetch(
        "/products.json?limit=250&fields=id,variants,image,images"
      );
      const skuToImage = new Map<string, string>();

      for (const product of data.products ?? []) {
        for (const variant of product.variants ?? []) {
          if (variant.sku && skusNeedingImage.has(variant.sku)) {
            // Use variant image if available, else fall back to first product image
            const src = variant.image_id
              ? (product.images ?? []).find((img) => img.id === variant.image_id)?.src
              : product.image?.src;
            if (src) skuToImage.set(variant.sku, src);
          }
        }
      }

      // Apply images back to line items
      for (const order of orders) {
        for (const li of order.lineItems) {
          if (li.sku && !li.imageUrl) {
            li.imageUrl = skuToImage.get(li.sku) ?? undefined;
          }
        }
      }
    } catch {
      // Non-fatal — images are best-effort
    }
  }

  private async resolveInventoryItemIds(skus: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    // Fetch all products (paginated at 250)
    const data = await this.shopifyFetch("/products.json?limit=250&fields=id,variants");

    for (const product of data.products ?? []) {
      for (const variant of product.variants ?? []) {
        if (
          variant.sku &&
          typeof variant.inventory_item_id === "number" &&
          skus.includes(variant.sku)
        ) {
          map.set(variant.sku, variant.inventory_item_id);
        }
      }
    }
    return map;
  }

  // ─── Location ID ────────────────────────────────────────────────────────────

  private async ensureLocationId(): Promise<number> {
    if (this.config.locationId) return parseInt(this.config.locationId, 10);
    // Auto-detect: use the first active location
    const data = await this.shopifyFetch("/locations.json");
    const active = (data.locations ?? []).find((location) => location.active);
    if (!active) throw new Error("No active Shopify location found");
    this.config.locationId = String(active.id);
    return active.id;
  }

  // ─── Connection test ────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.shopifyFetch("/shop.json");
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Tenant-scoped factory (preferred) ───────────────────────────────────────

/**
 * Create a ShopifyAdapter from explicit credentials (resolved from tenant DB).
 */
export function getShopifyAdapterForTenant(opts: {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
  locationId?: string;
}): ShopifyAdapter {
  return new ShopifyAdapter({
    shopDomain: opts.shopDomain,
    accessToken: opts.accessToken,
    apiVersion: opts.apiVersion ?? "2026-01",
    locationId: opts.locationId,
  });
}

// ─── Legacy factory using env vars (backward compat) ─────────────────────────

export function getShopifyAdapter(locationId?: string): ShopifyAdapter {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-01";

  if (!shopDomain || !accessToken) {
    throw new Error(
      "SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set to use Shopify integration"
    );
  }

  return new ShopifyAdapter({
    shopDomain,
    accessToken,
    apiVersion,
    locationId: locationId ?? process.env.SHOPIFY_LOCATION_ID ?? undefined,
  });
}
