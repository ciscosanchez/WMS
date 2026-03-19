/**
 * Amazon Marketplace Adapter (SP-API)
 *
 * Connects to Amazon Selling Partner API to:
 * - Import orders (Orders API v0)
 * - Sync inventory (Listings Feeds API)
 * - Push tracking (Order Fulfillment Feed)
 *
 * API Docs: https://developer-docs.amazon.com/sp-api/
 * Auth: LWA (Login with Amazon) OAuth 2.0 + AWS SigV4
 *
 * Required env vars:
 *   AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, AMAZON_REFRESH_TOKEN
 *   AMAZON_SELLER_ID, AMAZON_MARKETPLACE_ID (default: ATVPDKIKX0DER = US)
 *   AMAZON_AWS_ACCESS_KEY_ID, AMAZON_AWS_SECRET_ACCESS_KEY
 *   AMAZON_REGION (default: us-east-1)
 */

import { createHmac, createHash } from "crypto";
import type {
  MarketplaceAdapter,
  MarketplaceOrder,
  InventoryUpdate,
  FulfillmentUpdate,
} from "./types";

export interface AmazonConfig {
  sellerId: string;
  marketplaceId: string; // ATVPDKIKX0DER = US, A1F83G8C2ARO7P = UK
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  region: "us-east-1" | "eu-west-1" | "us-west-2";
}

const BASE_URLS: Record<string, string> = {
  "us-east-1": "https://sellingpartnerapi-na.amazon.com",
  "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
  "us-west-2": "https://sellingpartnerapi-fe.amazon.com",
};

interface LwaTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpOrderAddress {
  Name?: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  StateOrRegion?: string;
  PostalCode?: string;
  CountryCode?: string;
  Phone?: string;
}

interface SpOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  LatestShipDate?: string;
  OrderStatus: string;
  BuyerInfo?: { BuyerEmail?: string };
  ShippingAddress?: SpOrderAddress;
  ShipmentServiceLevelCategory?: string;
}

interface SpOrderItem {
  ASIN: string;
  SellerSKU?: string;
  OrderItemId: string;
  Title?: string;
  QuantityOrdered: number;
  ItemPrice?: { Amount?: string };
  ItemWeight?: { Value?: number; Unit?: string };
}

export class AmazonAdapter implements MarketplaceAdapter {
  channelName = "Amazon";
  private config: AmazonConfig;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: AmazonConfig) {
    this.config = config;
  }

  /** Exchange LWA refresh token for a short-lived access token (1-hour TTL). */
  private async getLwaToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon LWA token error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as LwaTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  /** Build AWS SigV4-signed headers for SP-API requests. */
  private buildSignedHeaders(
    method: string,
    url: string,
    accessToken: string,
    body = ""
  ): Record<string, string> {
    const parsedUrl = new URL(url);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const date = datetime.slice(0, 8);
    const { region } = this.config;
    const service = "execute-api";

    const baseHeaders: Record<string, string> = {
      host: parsedUrl.host,
      "x-amz-access-token": accessToken,
      "x-amz-date": datetime,
    };
    if (body) baseHeaders["content-type"] = "application/json";

    const sortedKeys = Object.keys(baseHeaders).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${baseHeaders[k]}\n`).join("");
    const signedHeadersStr = sortedKeys.join(";");

    // Sort query parameters for canonical request
    const sortedParams = [...parsedUrl.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonicalRequest = [
      method,
      parsedUrl.pathname,
      sortedParams,
      canonicalHeaders,
      signedHeadersStr,
      payloadHash,
    ].join("\n");

    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      credentialScope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    // Derive signing key: HMAC(HMAC(HMAC(HMAC("AWS4"+secretKey, date), region), service), "aws4_request")
    const signingKey = ["aws4_request", service, region, date].reduce(
      (key: Buffer, segment: string) =>
        createHmac("sha256", key).update(segment).digest() as unknown as Buffer,
      Buffer.from(`AWS4${this.config.awsSecretAccessKey}`) as Buffer
    );
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return {
      ...baseHeaders,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.config.awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`,
    };
  }

  private async spRequest<T>(
    method: string,
    path: string,
    params?: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    const baseUrl = BASE_URLS[this.config.region];
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const accessToken = await this.getLwaToken();
    const bodyStr = body ? JSON.stringify(body) : "";
    const headers = this.buildSignedHeaders(method, url.toString(), accessToken, bodyStr);

    const res = await fetch(url.toString(), {
      method,
      headers: { ...headers, Accept: "application/json" },
      body: bodyStr || undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SP-API ${method} ${path}: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async fetchOrders(since: Date): Promise<MarketplaceOrder[]> {
    const result = await this.spRequest<{
      payload?: { Orders?: SpOrder[]; NextToken?: string };
    }>("GET", "/orders/v0/orders", {
      MarketplaceIds: this.config.marketplaceId,
      CreatedAfter: since.toISOString(),
      OrderStatuses: "Unshipped,PartiallyShipped",
    });

    const orders: MarketplaceOrder[] = [];

    for (const spOrder of result.payload?.Orders ?? []) {
      const itemsResult = await this.spRequest<{
        payload?: { OrderItems?: SpOrderItem[] };
      }>("GET", `/orders/v0/orders/${spOrder.AmazonOrderId}/orderItems`);

      const addr = spOrder.ShippingAddress;
      orders.push({
        externalId: spOrder.AmazonOrderId,
        orderNumber: spOrder.AmazonOrderId,
        channel: "Amazon",
        orderDate: new Date(spOrder.PurchaseDate),
        shipByDate: spOrder.LatestShipDate ? new Date(spOrder.LatestShipDate) : undefined,
        priority: "standard",
        shipTo: {
          name: addr?.Name ?? "Unknown",
          address1: addr?.AddressLine1 ?? "",
          address2: addr?.AddressLine2,
          city: addr?.City ?? "",
          state: addr?.StateOrRegion ?? "",
          zip: addr?.PostalCode ?? "",
          country: addr?.CountryCode ?? "US",
          phone: addr?.Phone,
          email: spOrder.BuyerInfo?.BuyerEmail,
        },
        lineItems: (itemsResult.payload?.OrderItems ?? []).map((item) => ({
          externalLineId: item.OrderItemId,
          sku: item.SellerSKU ?? item.ASIN,
          name: item.Title ?? item.ASIN,
          quantity: item.QuantityOrdered,
          unitPrice: item.ItemPrice?.Amount ? parseFloat(item.ItemPrice.Amount) : 0,
          weightGrams: item.ItemWeight?.Value
            ? item.ItemWeight.Unit === "pounds"
              ? item.ItemWeight.Value * 453.592
              : item.ItemWeight.Value
            : undefined,
        })),
        shippingMethod: spOrder.ShipmentServiceLevelCategory,
      });
    }

    return orders;
  }

  /**
   * Sync inventory to Amazon via JSON_LISTINGS_FEED.
   * Uploads a feed document then submits the feed to the Feeds API.
   */
  async syncInventory(updates: InventoryUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    // Step 1: Create a feed document upload URL
    const docRes = await this.spRequest<{
      feedDocumentId: string;
      url: string;
    }>("POST", "/feeds/2021-06-30/documents", undefined, {
      contentType: "application/json; charset=UTF-8",
    });

    // Step 2: Upload the inventory feed to the pre-signed S3 URL
    const feed = {
      header: {
        sellerId: this.config.sellerId,
        version: "2.0",
        issueLocale: "en_US",
      },
      messages: updates.map((u, i) => ({
        messageId: i + 1,
        sku: u.sku,
        operationType: "PATCH",
        productType: "PRODUCT",
        patches: [
          {
            op: "replace",
            path: "/attributes/fulfillment_availability",
            value: [
              {
                fulfillment_channel_code: "DEFAULT",
                quantity: u.availableQuantity,
              },
            ],
          },
        ],
      })),
    };

    await fetch(docRes.url, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(feed),
    });

    // Step 3: Submit the feed
    await this.spRequest("POST", "/feeds/2021-06-30/feeds", undefined, {
      feedType: "JSON_LISTINGS_FEED",
      marketplaceIds: [this.config.marketplaceId],
      inputFeedDocumentId: docRes.feedDocumentId,
    });
  }

  /**
   * Push fulfillment/tracking to Amazon via POST_ORDER_FULFILLMENT_DATA feed (TSV).
   */
  async pushFulfillment(update: FulfillmentUpdate): Promise<void> {
    const carrierMap: Record<string, string> = {
      UPS: "UPS",
      FedEx: "FDXG",
      USPS: "USPS",
      DHL: "DHLG",
    };

    const carrierCode = carrierMap[update.carrier ?? ""] ?? "OTHER";
    const shippedAt = update.shippedAt
      ? new Date(update.shippedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Build TSV fulfillment feed
    const lines = [
      "order-id\torder-item-id\tquantity\tship-date\tcarrier-code\ttracking-number",
      ...update.lineItems.map((li) =>
        [
          update.externalOrderId,
          li.externalLineId,
          li.quantity,
          shippedAt,
          carrierCode,
          update.trackingNumber,
        ].join("\t")
      ),
    ];
    const tsvBody = lines.join("\n");

    // Create feed document
    const docRes = await this.spRequest<{
      feedDocumentId: string;
      url: string;
    }>("POST", "/feeds/2021-06-30/documents", undefined, {
      contentType: "text/tab-separated-values; charset=UTF-8",
    });

    await fetch(docRes.url, {
      method: "PUT",
      headers: { "Content-Type": "text/tab-separated-values; charset=UTF-8" },
      body: tsvBody,
    });

    await this.spRequest("POST", "/feeds/2021-06-30/feeds", undefined, {
      feedType: "POST_ORDER_FULFILLMENT_DATA",
      marketplaceIds: [this.config.marketplaceId],
      inputFeedDocumentId: docRes.feedDocumentId,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.spRequest("GET", "/sellers/v1/marketplaceParticipations");
      return true;
    } catch {
      return false;
    }
  }
}

export function getAmazonAdapter(): AmazonAdapter | null {
  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN;
  const sellerId = process.env.AMAZON_SELLER_ID;
  const awsKeyId = process.env.AMAZON_AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AMAZON_AWS_SECRET_ACCESS_KEY;

  if (!clientId || !clientSecret || !refreshToken || !sellerId || !awsKeyId || !awsSecret) {
    return null;
  }

  return new AmazonAdapter({
    clientId,
    clientSecret,
    refreshToken,
    sellerId,
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID ?? "ATVPDKIKX0DER",
    awsAccessKeyId: awsKeyId,
    awsSecretAccessKey: awsSecret,
    region: (process.env.AMAZON_REGION as AmazonConfig["region"] | undefined) ?? "us-east-1",
  });
}
