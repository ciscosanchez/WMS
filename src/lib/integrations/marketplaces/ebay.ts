/**
 * eBay Marketplace Adapter — eBay Fulfillment API + OAuth 2.0 client credentials.
 * API Docs: https://developer.ebay.com/api-docs/sell/fulfillment/overview.html
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface EbayConfig {
  appId: string;
  certId: string;
  devId: string;
  userToken: string;
  sandbox?: boolean;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const EBAY_STATUS_MAP: Record<string, string> = {
  AWAITING_PAYMENT: "pending",
  PAID: "pending",
  AWAITING_SHIPMENT: "pending",
  SHIPPED: "shipped",
  DELIVERED: "shipped",
  CANCELLED: "cancelled",
  REFUNDED: "cancelled",
};

export function mapEbayStatus(ebayStatus: string): string {
  return EBAY_STATUS_MAP[ebayStatus] ?? "pending";
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class EbayAdapter implements MarketplaceAdapter {
  channelName = "eBay";
  private config: EbayConfig;
  private baseUrl: string;
  private authUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: EbayConfig) {
    this.config = config;
    this.baseUrl = config.sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
    this.authUrl = config.sandbox
      ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
      : "https://api.ebay.com/identity/v1/oauth2/token";
  }

  // ─── OAuth 2.0 client credentials ────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.config.appId}:${this.config.certId}`).toString(
      "base64"
    );

    const res = await fetch(this.authUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`eBay OAuth ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    // Expire 60s early to avoid edge-case failures
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = this.config.userToken || (await this.getAccessToken());
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    };
  }

  private async ebayFetch(path: string, init?: RequestInit) {
    const hdrs = await this.headers();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...hdrs, ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`eBay API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // ─── Fetch orders ──────────────────────────────────────────────────────────

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const isoDate = since.toISOString();
    const filter = `creationdate:[${isoDate}..]`;
    const params = new URLSearchParams({ filter, limit: "50" });

    const data = await this.ebayFetch(`/sell/fulfillment/v1/order?${params}`);
    const orders: MarketplaceOrder[] = (data.orders ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => this.mapOrder(o)
    );
    return orders;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapOrder(o: any): MarketplaceOrder {
    const fulfillment = o.fulfillmentStartInstructions?.[0] ?? {};
    const shipTo = fulfillment.shippingStep?.shipTo ?? {};
    const contact = shipTo.contactAddress ?? shipTo;
    const buyer = o.buyer ?? {};

    const fullName =
      shipTo.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ?? "";

    const addr = contact.contactAddress ?? contact;

    // eBay line items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItems = (o.lineItems ?? []).map((li: any) => ({
      externalLineId: String(li.lineItemId ?? li.legacyItemId ?? ""),
      sku: li.sku ?? li.legacyVariationId ?? "",
      name: li.title ?? "",
      quantity: li.quantity ?? 1,
      unitPrice: parseFloat(li.lineItemCost?.value ?? li.total?.value ?? "0"),
      weightGrams: undefined,
      imageUrl: li.image?.imageUrl ?? undefined,
    }));

    const orderStatus = mapEbayStatus(o.orderFulfillmentStatus ?? o.orderPaymentStatus ?? "");

    return {
      externalId: o.orderId ?? o.legacyOrderId ?? String(o.orderId),
      orderNumber: o.legacyOrderId ?? o.orderId ?? "",
      channel: "eBay",
      orderDate: new Date(o.creationDate ?? Date.now()),
      priority: "standard",
      shipTo: {
        name: fullName,
        address1: addr.addressLine1 ?? "",
        address2: addr.addressLine2 ?? undefined,
        city: addr.city ?? "",
        state: addr.stateOrProvince ?? "",
        zip: addr.postalCode ?? "",
        country: addr.countryCode ?? "US",
        phone: shipTo.primaryPhone?.phoneNumber ?? undefined,
        email: buyer.buyerRegistrationAddress?.email ?? buyer.email ?? undefined,
      },
      lineItems,
      shippingMethod: fulfillment.shippingStep?.shippingServiceCode ?? undefined,
      notes: o.buyerCheckoutNotes ?? undefined,
    };
  }

  // ─── Push fulfillment ──────────────────────────────────────────────────────

  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    const body = {
      lineItems: (update.lineItems ?? []).map((li) => ({
        lineItemId: li.externalLineId,
        quantity: li.quantity,
      })),
      shippingFulfillments: [
        {
          trackingNumber: update.trackingNumber,
          shippingCarrierCode: update.carrier,
          shippedDate: update.shippedAt.toISOString(),
        },
      ],
    };
    await this.ebayFetch(
      `/sell/fulfillment/v1/order/${update.externalOrderId}/shipping_fulfillment`,
      { method: "POST", body: JSON.stringify(body) }
    );
  }

  // ─── Sync inventory ────────────────────────────────────────────────────────

  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    for (const update of updates) {
      const body = { offers: [{ sku: update.sku, availableQuantity: update.availableQuantity }] };
      try {
        await this.ebayFetch("/sell/inventory/v1/bulk_update_price_quantity", {
          method: "POST",
          body: JSON.stringify(body),
        });
      } catch {
        console.error(`[eBay] Failed to sync inventory for SKU ${update.sku}`);
      }
    }
  }

  // ─── Connection test ───────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Tenant-scoped factory (preferred) ───────────────────────────────────────

export function getEbayAdapterForTenant(opts: {
  appId: string;
  certId: string;
  devId: string;
  userToken: string;
  sandbox?: boolean;
}): EbayAdapter {
  return new EbayAdapter(opts);
}

// ─── Legacy factory using env vars (backward compat) ─────────────────────────

export function getEbayAdapter(): EbayAdapter {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const devId = process.env.EBAY_DEV_ID;
  const userToken = process.env.EBAY_USER_TOKEN ?? "";

  if (!appId || !certId || !devId) {
    throw new Error(
      "EBAY_APP_ID, EBAY_CERT_ID, and EBAY_DEV_ID must be set to use eBay integration"
    );
  }

  return new EbayAdapter({
    appId,
    certId,
    devId,
    userToken,
    sandbox: process.env.EBAY_SANDBOX === "true",
  });
}
