/**
 * NetSuite ERP Integration Client
 *
 * Uses NetSuite SuiteTalk REST API with OAuth 1.0a TBA (Token-Based Authentication).
 * Each request is signed with HMAC-SHA256 using consumer and token credentials.
 *
 * Docs: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1558708800.html
 *
 * Required env vars (when live):
 *   NETSUITE_ACCOUNT_ID, NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET
 *   NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET
 */

import crypto from "crypto";

export interface NetSuiteConfig {
  accountId: string; // e.g. "1234567" or "TSTDRV1234567"
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}

export interface BillableEvent {
  clientId: string;
  eventType: "receiving" | "storage" | "handling" | "shipping" | "value_add";
  description: string;
  quantity: number;
  unitRate: number;
  total: number;
  referenceType: string;
  referenceId: string;
  occurredAt: Date;
}

export class NetSuiteClient {
  private config: NetSuiteConfig;
  private baseUrl: string;

  constructor(config: NetSuiteConfig) {
    this.config = config;
    // NetSuite REST base: account ID lowercased, underscores → hyphens
    const subdomain = config.accountId.toLowerCase().replace(/_/g, "-");
    this.baseUrl = `https://${subdomain}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  }

  // ── OAuth 1.0a TBA signing ────────────────────────────────────────────────

  /**
   * Build a signed Authorization header for a NetSuite REST API request.
   * Uses HMAC-SHA256 per NetSuite TBA specification.
   */
  private buildAuthHeader(method: string, url: string): string {
    const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = this.config;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");

    // OAuth parameters (sorted alphabetically for base string)
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: timestamp,
      oauth_token: tokenId,
      oauth_version: "1.0",
    };

    // Parse existing query params from URL and merge with oauth params for base string
    const urlObj = new URL(url);
    const allParams: Record<string, string> = { ...oauthParams };
    urlObj.searchParams.forEach((v, k) => {
      allParams[k] = v;
    });

    // Normalize parameters: sort by key, then by value
    const normalizedParams = Object.entries(allParams)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    // Build the base string
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(baseUrl),
      encodeURIComponent(normalizedParams),
    ].join("&");

    // Signing key: consumerSecret & tokenSecret (both percent-encoded)
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

    // HMAC-SHA256 signature
    const signature = crypto.createHmac("sha256", signingKey).update(baseString).digest("base64");

    // Build Authorization header
    const headerParts = [
      `realm="${accountId}"`,
      `oauth_consumer_key="${consumerKey}"`,
      `oauth_nonce="${nonce}"`,
      `oauth_signature="${encodeURIComponent(signature)}"`,
      `oauth_signature_method="HMAC-SHA256"`,
      `oauth_timestamp="${timestamp}"`,
      `oauth_token="${tokenId}"`,
      `oauth_version="1.0"`,
    ];

    return `OAuth ${headerParts.join(", ")}`;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const authHeader = this.buildAuthHeader(method, url.toString());

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        prefer: "respond-async",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NetSuite ${method} ${path} failed (${res.status}): ${text}`);
    }

    // 204 No Content (e.g., after a PATCH/POST that returns no body)
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  // ── Customer sync ─────────────────────────────────────────────────────────

  /**
   * Pull a single customer record from NetSuite and return WMS client fields.
   */
  async syncCustomer(netsuiteCustomerId: string): Promise<{
    name: string;
    code: string;
    email: string;
    address: string;
  }> {
    const data = await this.request<{
      entityid: string;
      companyname?: string;
      firstname?: string;
      lastname?: string;
      email?: string;
      defaultaddress?: string;
    }>("GET", `/customer/${netsuiteCustomerId}`);

    const name = data.companyname || `${data.firstname ?? ""} ${data.lastname ?? ""}`.trim();

    return {
      name,
      code: data.entityid,
      email: data.email ?? "",
      address: data.defaultaddress ?? "",
    };
  }

  /**
   * List all active NetSuite customers.
   */
  async listCustomers(): Promise<Array<{ id: string; name: string; code: string }>> {
    const data = await this.request<{
      items?: Array<{ id: string; entityid: string; companyname?: string }>;
    }>("GET", "/customer", undefined, {
      q: "isinactive IS false",
      limit: "1000",
    });

    return (data.items ?? []).map((c) => ({
      id: c.id,
      name: c.companyname ?? c.entityid,
      code: c.entityid,
    }));
  }

  // ── Receiving confirmation ────────────────────────────────────────────────

  /**
   * Push an item receipt to NetSuite (equivalent to receiving a PO in NetSuite).
   * Requires a corresponding Purchase Order to exist in NetSuite.
   */
  async pushReceivingConfirmation(
    shipmentId: string,
    lines: Array<{
      itemId: string; // NetSuite internal item ID
      quantity: number;
      locationId: string;
    }>
  ): Promise<void> {
    await this.request("POST", "/itemreceipt", {
      custbody_wms_shipment_id: shipmentId,
      itemList: {
        item: lines.map((line) => ({
          item: { id: line.itemId },
          quantity: line.quantity,
          location: { id: line.locationId },
        })),
      },
    });
  }

  // ── Shipment fulfillment ──────────────────────────────────────────────────

  /**
   * Push an item fulfillment record to NetSuite when an order ships.
   * Requires a corresponding Sales Order to exist in NetSuite.
   */
  async pushShipmentFulfillment(
    orderId: string,
    trackingNumber: string,
    carrier: string
  ): Promise<void> {
    await this.request("POST", "/itemfulfillment", {
      custbody_wms_order_id: orderId,
      shippingcarrier: carrier,
      trackingnumbers: trackingNumber,
    });
  }

  // ── Billing / invoice push ────────────────────────────────────────────────

  /**
   * Push billable WMS events to NetSuite as a single invoice.
   * Assumes NetSuite items exist per service type (mapped via `custbody_wms_service_type`).
   */
  async pushBillableEvents(events: BillableEvent[]): Promise<{ invoiceId: string }> {
    if (events.length === 0) throw new Error("No events to push");

    // Group by clientId — all events should be for the same client in one call
    const clientId = events[0].clientId;
    const subtotal = events.reduce((s, e) => s + e.total, 0);

    const invoiceLines = events.map((e) => ({
      description: e.description,
      quantity: e.quantity,
      rate: e.unitRate,
      amount: e.total,
      custcol_wms_service_type: e.eventType,
      custcol_wms_reference_id: e.referenceId,
    }));

    const data = await this.request<{ id: string }>("POST", "/invoice", {
      entity: { id: clientId },
      trandate: events[0].occurredAt.toISOString().slice(0, 10),
      custbody_wms_source: "armstrong-wms",
      itemList: { item: invoiceLines },
      subtotal,
    });

    return { invoiceId: data.id };
  }

  // ── Product / item sync ───────────────────────────────────────────────────

  /**
   * Sync a WMS product to a NetSuite inventory item (upsert by externalId).
   */
  async upsertProduct(product: {
    sku: string;
    name: string;
    description?: string;
    unitCost?: number;
  }): Promise<{ netsuiteId: string }> {
    // Search for existing item by custitem_wms_sku
    const existing = await this.request<{ items?: Array<{ id: string }> }>(
      "GET",
      "/inventoryitem",
      undefined,
      { q: `custitem_wms_sku IS "${product.sku}"`, limit: "1" }
    ).catch(() => ({ items: [] }));

    const existingId = existing.items?.[0]?.id;
    const body = {
      itemid: product.sku,
      displayname: product.name,
      description: product.description ?? "",
      custitem_wms_sku: product.sku,
      ...(product.unitCost ? { cost: product.unitCost } : {}),
    };

    if (existingId) {
      await this.request("PATCH", `/inventoryitem/${existingId}`, body);
      return { netsuiteId: existingId };
    } else {
      const created = await this.request<{ id: string }>("POST", "/inventoryitem", body);
      return { netsuiteId: created.id };
    }
  }
}

/**
 * Factory: returns a configured NetSuiteClient from env vars, or null if not configured.
 */
export function getNetSuiteClient(overrides?: Record<string, string>): NetSuiteClient | null {
  const accountId = overrides?.accountId ?? process.env.NETSUITE_ACCOUNT_ID;
  const consumerKey = overrides?.consumerKey ?? process.env.NETSUITE_CONSUMER_KEY;
  const consumerSecret = overrides?.consumerSecret ?? process.env.NETSUITE_CONSUMER_SECRET;
  const tokenId = overrides?.tokenId ?? process.env.NETSUITE_TOKEN_ID;
  const tokenSecret = overrides?.tokenSecret ?? process.env.NETSUITE_TOKEN_SECRET;

  if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
    return null;
  }

  return new NetSuiteClient({
    accountId,
    consumerKey,
    consumerSecret,
    tokenId,
    tokenSecret,
  });
}
