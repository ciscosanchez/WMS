/**
 * BigCommerce Marketplace Adapter
 *
 * Connects to BigCommerce API v3 to:
 * - Import orders into WMS
 * - Sync inventory levels
 * - Push tracking/fulfillment info
 *
 * Auth: BigCommerce uses store hash + API access token.
 * API Docs: https://developer.bigcommerce.com/docs/rest-management/orders
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
}

export class BigCommerceAdapter implements MarketplaceAdapter {
  channelName = "BigCommerce";
  private config: BigCommerceConfig;
  private baseUrl: string;

  constructor(config: BigCommerceConfig) {
    this.config = config;
    this.baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/v3`;
  }

  private headers() {
    return {
      "X-Auth-Token": this.config.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async bcFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`BigCommerce API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // V2 API for orders (BigCommerce orders are still on v2)
  private async bcFetchV2(path: string, init?: RequestInit) {
    const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`BigCommerce V2 API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // ─── Fetch orders ────────────────────────────────────────────────────────────

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const minDate = since.toISOString();
    const data = await this.bcFetchV2(
      `/orders?min_date_modified=${minDate}&status_id=11&limit=250`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((o: any) => this.mapOrder(o));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapOrder(o: any): MarketplaceOrder {
    const addr = o.shipping_addresses?.[0] ?? o.billing_address ?? {};

    return {
      externalId: String(o.id),
      orderNumber: `BC-${o.id}`,
      channel: "BigCommerce",
      orderDate: new Date(o.date_created),
      priority: "standard",
      shipTo: {
        name: `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim(),
        address1: addr.street_1 ?? "",
        address2: addr.street_2 ?? undefined,
        city: addr.city ?? "",
        state: addr.state ?? "",
        zip: addr.zip ?? "",
        country: addr.country_iso2 ?? "US",
        phone: addr.phone ?? undefined,
        email: o.billing_address?.email ?? undefined,
      },
      lineItems: (o.products?.url ? [] : (o.products ?? [])).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ({
          externalLineId: String(p.id),
          sku: p.sku ?? "",
          name: p.name ?? "",
          quantity: p.quantity ?? 1,
          unitPrice: parseFloat(p.base_price ?? "0"),
        })
      ),
      shippingMethod: o.shipping_method ?? undefined,
    };
  }

  // ─── Push fulfillment ────────────────────────────────────────────────────────

  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    await this.bcFetchV2(`/orders/${update.externalOrderId}/shipments`, {
      method: "POST",
      body: JSON.stringify({
        tracking_number: update.trackingNumber,
        tracking_carrier: update.carrier,
        items: (update.lineItems ?? []).map((li) => ({
          order_product_id: parseInt(li.externalLineId, 10),
          quantity: li.quantity,
        })),
      }),
    });
  }

  // ─── Sync inventory ──────────────────────────────────────────────────────────

  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    // BigCommerce v3 catalog API for inventory
    for (const u of updates) {
      // Need to find variant by SKU first
      const searchResult = await this.bcFetch(
        `/catalog/variants?sku=${encodeURIComponent(u.sku)}&limit=1`
      );
      const variant = searchResult?.data?.[0];
      if (!variant) continue;

      await this.bcFetch(`/catalog/variants/${variant.id}`, {
        method: "PUT",
        body: JSON.stringify({
          inventory_level: u.availableQuantity,
        }),
      });
    }
  }

  // ─── Test connection ─────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.bcFetchV2("/store");
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory functions ─────────────────────────────────────────────────────────

export function getBigCommerceAdapterForTenant(opts: {
  storeHash: string;
  accessToken: string;
}): BigCommerceAdapter {
  return new BigCommerceAdapter(opts);
}

export function getBigCommerceAdapter(): BigCommerceAdapter {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error("BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN must be set");
  }

  return new BigCommerceAdapter({ storeHash, accessToken });
}
