/**
 * Walmart Marketplace Adapter
 *
 * Connects to Walmart Marketplace API to:
 * - Import orders into WMS
 * - Sync inventory levels
 * - Push tracking/fulfillment info
 *
 * Auth: Walmart uses client ID + client secret for OAuth 2.0 token-based auth.
 * API Docs: https://developer.walmart.com/api/us/mp/orders
 */

import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface WalmartConfig {
  clientId: string;
  clientSecret: string;
  environment: "production" | "sandbox";
}

export class WalmartAdapter implements MarketplaceAdapter {
  channelName = "Walmart";
  private config: WalmartConfig;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: WalmartConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "sandbox"
        ? "https://sandbox.walmartapis.com"
        : "https://marketplace.walmartapis.com";
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      "base64"
    );

    const res = await fetch(`${this.baseUrl}/v3/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "WM_SVC.NAME": process.env.APP_NAME || "Ramola WMS",
        "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Walmart token error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 900) * 1000;
    return this.accessToken!;
  }

  private async walmartFetch(path: string, init?: RequestInit) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "WM_SVC.NAME": process.env.APP_NAME || "Ramola WMS",
        "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Walmart API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  // ─── Fetch orders ────────────────────────────────────────────────────────────

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const params = new URLSearchParams({
      createdStartDate: since.toISOString(),
      status: "Created",
      limit: "200",
    });

    const data = await this.walmartFetch(`/v3/orders?${params}`);
    const orders = data?.list?.elements?.order ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return orders.map((o: any) => this.mapOrder(o));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapOrder(o: any): MarketplaceOrder {
    const addr = o.shippingInfo?.postalAddress ?? {};
    const orderLines = o.orderLines?.orderLine ?? [];

    return {
      externalId: String(o.purchaseOrderId),
      orderNumber: String(o.customerOrderId),
      channel: "Walmart",
      orderDate: new Date(o.orderDate),
      shipByDate: o.shippingInfo?.estimatedShipDate
        ? new Date(o.shippingInfo.estimatedShipDate)
        : undefined,
      priority: "standard",
      shipTo: {
        name: addr.name ?? "",
        address1: addr.address1 ?? "",
        address2: addr.address2 ?? undefined,
        city: addr.city ?? "",
        state: addr.state ?? "",
        zip: addr.postalCode ?? "",
        country: addr.country ?? "US",
        phone: o.shippingInfo?.phone ?? undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineItems: orderLines.map((line: any) => {
        const item = line.item ?? {};
        const charges = line.charges?.charge ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productCharge = charges.find((c: any) => c.chargeType === "PRODUCT");
        return {
          externalLineId: String(line.lineNumber),
          sku: item.sku ?? "",
          name: item.productName ?? "",
          quantity: line.orderLineQuantity?.amount
            ? parseInt(line.orderLineQuantity.amount, 10)
            : 1,
          unitPrice: productCharge?.chargeAmount?.amount
            ? parseFloat(productCharge.chargeAmount.amount)
            : 0,
        };
      }),
      shippingMethod: o.shippingInfo?.methodCode ?? undefined,
    };
  }

  // ─── Push fulfillment ────────────────────────────────────────────────────────

  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    const carrierMap: Record<string, string> = {
      UPS: "UPS",
      FedEx: "FedEx",
      USPS: "USPS",
      DHL: "DHL",
    };
    const carrier = carrierMap[update.carrier] ?? update.carrier;

    await this.walmartFetch(`/v3/orders/${update.externalOrderId}/shipping`, {
      method: "POST",
      body: JSON.stringify({
        orderShipment: {
          orderLines: {
            orderLine: (update.lineItems ?? []).map((li) => ({
              lineNumber: li.externalLineId,
              orderLineStatuses: {
                orderLineStatus: [
                  {
                    status: "Shipped",
                    statusQuantity: {
                      unitOfMeasurement: "EACH",
                      amount: String(li.quantity),
                    },
                    trackingInfo: {
                      shipDateTime: update.shippedAt.toISOString(),
                      carrierName: { carrier },
                      trackingNumber: update.trackingNumber,
                    },
                  },
                ],
              },
            })),
          },
        },
      }),
    });
  }

  // ─── Sync inventory ──────────────────────────────────────────────────────────

  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    for (const u of updates) {
      await this.walmartFetch("/v3/inventory", {
        method: "PUT",
        body: JSON.stringify({
          sku: u.sku,
          quantity: { unit: "EACH", amount: u.availableQuantity },
        }),
      });
    }
  }

  // ─── Test connection ─────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory functions ─────────────────────────────────────────────────────────

export function getWalmartAdapterForTenant(opts: {
  clientId: string;
  clientSecret: string;
  environment?: "production" | "sandbox";
}): WalmartAdapter {
  return new WalmartAdapter({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    environment: opts.environment ?? "production",
  });
}

export function getWalmartAdapter(): WalmartAdapter {
  const clientId = process.env.WALMART_CLIENT_ID;
  const clientSecret = process.env.WALMART_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "WALMART_CLIENT_ID and WALMART_CLIENT_SECRET must be set to use Walmart integration"
    );
  }

  return new WalmartAdapter({
    clientId,
    clientSecret,
    environment: (process.env.WALMART_ENVIRONMENT as "production" | "sandbox") ?? "production",
  });
}
