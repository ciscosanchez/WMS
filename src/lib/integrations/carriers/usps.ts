/**
 * USPS Carrier Adapter
 *
 * Uses the USPS REST API v3 (OAuth 2.0 client credentials) for rating, shipping,
 * tracking, and void. Makes parallel rate calls for each main mail class.
 *
 * API Documentation: https://developer.usps.com/api
 *
 * Required env vars (when live):
 *   USPS_CLIENT_ID, USPS_CLIENT_SECRET
 */

import type {
  CarrierAdapter,
  RateRequest,
  RateQuote,
  LabelRequest,
  LabelResult,
  TrackingResult,
} from "./types";

export interface USPSConfig {
  clientId: string;
  clientSecret: string;
  useSandbox?: boolean;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface MailClassConfig {
  mailClass: string;
  serviceName: string;
  estimatedDays: number;
  guaranteed: boolean;
  processingCategory: string;
  rateIndicator: string;
}

const MAIL_CLASSES: MailClassConfig[] = [
  {
    mailClass: "USPS_GROUND_ADVANTAGE",
    serviceName: "USPS Ground Advantage",
    estimatedDays: 5,
    guaranteed: false,
    processingCategory: "MACHINABLE",
    rateIndicator: "DR",
  },
  {
    mailClass: "PRIORITY_MAIL",
    serviceName: "USPS Priority Mail",
    estimatedDays: 2,
    guaranteed: false,
    processingCategory: "MACHINABLE",
    rateIndicator: "DR",
  },
  {
    mailClass: "PRIORITY_MAIL_EXPRESS",
    serviceName: "USPS Priority Mail Express",
    estimatedDays: 1,
    guaranteed: true,
    processingCategory: "MACHINABLE",
    rateIndicator: "DR",
  },
];

export class USPSAdapter implements CarrierAdapter {
  readonly name = "USPS";

  private config: USPSConfig;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;

  constructor(config: USPSConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox ? "https://api-cat.usps.com" : "https://api.usps.com";
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(`${this.baseUrl}/oauth2/v3/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`USPS auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const expiresIn = (data.expires_in ?? 3600) as number;
    this.tokenCache = {
      token: data.access_token as string,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };
    return this.tokenCache.token;
  }

  private async authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  }

  // ── Rates ──────────────────────────────────────────────────────────────────

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    const pkg = request.packages[0];
    // USPS works with ZIP codes only (no full address needed for rating)
    const fromZip = request.from.zip.slice(0, 5);
    const toZip = request.to.zip.slice(0, 5);

    const weightLbs = pkg.weightUnit === "kg" ? pkg.weight * 2.20462 : pkg.weight;
    const lengthIn = pkg.dimUnit === "cm" ? pkg.length / 2.54 : pkg.length;
    const widthIn = pkg.dimUnit === "cm" ? pkg.width / 2.54 : pkg.width;
    const heightIn = pkg.dimUnit === "cm" ? pkg.height / 2.54 : pkg.height;

    const results = await Promise.allSettled(
      MAIL_CLASSES.map(async (mc) => {
        const body = {
          originZIPCode: fromZip,
          destinationZIPCode: toZip,
          weight: parseFloat(weightLbs.toFixed(2)),
          length: parseFloat(lengthIn.toFixed(2)),
          width: parseFloat(widthIn.toFixed(2)),
          height: parseFloat(heightIn.toFixed(2)),
          mailClass: mc.mailClass,
          processingCategory: mc.processingCategory,
          rateIndicator: mc.rateIndicator,
          destinationEntryFacilityType: "NONE",
          priceType: "RETAIL",
        };

        const res = await this.authedFetch(`${this.baseUrl}/prices/v3/total-rates/search`, {
          method: "POST",
          body: JSON.stringify(body),
        });

        if (!res.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await res.json()) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rates: any[] = data.totalRates ?? [];
        if (rates.length === 0) return null;

        // Pick the base (non-cubic) rate — lowest price entry
        const baseRate = rates.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (min: any, r: any) => (r.price < (min?.price ?? Infinity) ? r : min),
          null
        );

        if (!baseRate) return null;

        return {
          carrier: "USPS",
          service: mc.serviceName,
          serviceCode: mc.mailClass,
          totalCost: parseFloat(baseRate.price),
          currency: "USD",
          estimatedDays: mc.estimatedDays,
          guaranteed: mc.guaranteed,
        } satisfies RateQuote;
      })
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<RateQuote> => r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
  }

  // ── Label ─────────────────────────────────────────────────────────────────

  async createLabel(request: LabelRequest): Promise<LabelResult> {
    const pkg = request.packages[0];
    const weightLbs = pkg.weightUnit === "kg" ? pkg.weight * 2.20462 : pkg.weight;
    const lengthIn = pkg.dimUnit === "cm" ? pkg.length / 2.54 : pkg.length;
    const widthIn = pkg.dimUnit === "cm" ? pkg.width / 2.54 : pkg.width;
    const heightIn = pkg.dimUnit === "cm" ? pkg.height / 2.54 : pkg.height;

    const mc = MAIL_CLASSES.find((m) => m.mailClass === request.serviceCode) ?? MAIL_CLASSES[0];

    const body = {
      imageInfo: { imageType: "PDF", labelType: "4X6LABEL" },
      toAddress: {
        firstName: request.to.name.split(" ")[0],
        lastName: request.to.name.split(" ").slice(1).join(" ") || " ",
        firm: request.to.company ?? "",
        streetAddress: request.to.street1,
        secondaryAddress: request.to.street2 ?? "",
        city: request.to.city,
        state: request.to.state,
        ZIPCode: request.to.zip.slice(0, 5),
        ZIPPlus4: request.to.zip.slice(6, 10) || "",
      },
      fromAddress: {
        firstName: request.from.name.split(" ")[0],
        lastName: request.from.name.split(" ").slice(1).join(" ") || " ",
        firm: request.from.company ?? "",
        streetAddress: request.from.street1,
        secondaryAddress: request.from.street2 ?? "",
        city: request.from.city,
        state: request.from.state,
        ZIPCode: request.from.zip.slice(0, 5),
        ZIPPlus4: request.from.zip.slice(6, 10) || "",
        phone: request.from.phone ?? "",
      },
      packageDescription: {
        mailClass: mc.mailClass,
        processingCategory: mc.processingCategory,
        rateIndicator: mc.rateIndicator,
        destinationEntryFacilityType: "NONE",
        weight: parseFloat(weightLbs.toFixed(2)),
        length: parseFloat(lengthIn.toFixed(2)),
        width: parseFloat(widthIn.toFixed(2)),
        height: parseFloat(heightIn.toFixed(2)),
        ...(request.reference ? { po: request.reference } : {}),
      },
    };

    const res = await this.authedFetch(`${this.baseUrl}/labels/v3/label`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`USPS label failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const trackingNumber = data.labelMetadata?.trackingNumber ?? data.trackingNumber;
    const labelData = data.labelImage ?? "";
    const cost = parseFloat(data.labelMetadata?.postage ?? data.postage ?? "0");

    return {
      trackingNumber,
      labelFormat: "PDF",
      labelData,
      totalCost: cost,
      carrier: "USPS",
      service: mc.serviceName,
    };
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    const url = new URL(`${this.baseUrl}/tracking/v3/tracking/${trackingNumber}`);
    url.searchParams.set("expand", "DETAIL");

    const res = await this.authedFetch(url.toString());

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`USPS tracking failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = data.trackingEvents ?? data.TrackSummary?.TrackDetail ?? [];

    const latestEvent = events[0];
    const eventType = (latestEvent?.eventType ?? "") as string;
    const status: TrackingResult["status"] =
      eventType === "DELIVERED" || eventType.includes("DELIVERY")
        ? "delivered"
        : eventType.includes("EXCEPTION") || eventType.includes("ALERT")
          ? "exception"
          : "in_transit";

    const mappedEvents = events.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => {
        const ts = e.eventTimestamp
          ? new Date(e.eventTimestamp)
          : new Date(`${e.eventDate} ${e.eventTime}`);
        return {
          timestamp: ts,
          status: e.eventType ?? e.Event ?? "Unknown",
          location: [e.eventCity, e.eventState].filter(Boolean).join(", "),
          description: e.eventDescription ?? e.EventDescription ?? "",
        };
      }
    );

    const deliveredAt =
      status === "delivered"
        ? (mappedEvents[0]?.timestamp ?? new Date(data.deliveryDateTime ?? Date.now()))
        : undefined;

    const estimatedDelivery = data.expectedDeliveryDateTime
      ? new Date(data.expectedDeliveryDateTime)
      : undefined;

    return {
      trackingNumber,
      carrier: "USPS",
      status,
      ...(deliveredAt ? { deliveredAt } : {}),
      ...(estimatedDelivery ? { estimatedDelivery } : {}),
      events: mappedEvents,
    } as TrackingResult;
  }

  // ── Void ──────────────────────────────────────────────────────────────────

  async voidLabel(trackingNumber: string): Promise<boolean> {
    const res = await this.authedFetch(`${this.baseUrl}/labels/v3/label/${trackingNumber}`, {
      method: "DELETE",
    });
    return res.ok || res.status === 204;
  }
}
