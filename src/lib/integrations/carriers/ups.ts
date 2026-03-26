/**
 * UPS Carrier Adapter
 *
 * Uses the UPS REST API (OAuth 2.0 client credentials) for rating, shipping,
 * tracking, and void. Tokens are cached in-memory for their full 4-hour TTL.
 *
 * API Documentation: https://developer.ups.com/api/reference
 *
 * Required env vars (when live):
 *   UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER
 */

import type {
  CarrierAdapter,
  RateRequest,
  RateQuote,
  LabelRequest,
  LabelResult,
  TrackingResult,
} from "./types";

export interface UPSConfig {
  accountNumber: string;
  clientId: string;
  clientSecret: string;
  useSandbox?: boolean;
}

// In-memory token cache (per adapter instance)
interface TokenCache {
  token: string;
  expiresAt: number; // ms timestamp
}

const UPS_SERVICE_NAMES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early A.M.",
  "59": "UPS 2nd Day Air A.M.",
  "65": "UPS Saver",
};

const UPS_SERVICE_DAYS: Record<string, number> = {
  "01": 1,
  "02": 2,
  "03": 5,
  "12": 3,
  "13": 1,
  "14": 1,
  "59": 2,
  "65": 3,
};

const UPS_GUARANTEED: Record<string, boolean> = {
  "01": true,
  "02": true,
  "03": false,
  "12": false,
  "13": true,
  "14": true,
  "59": true,
  "65": true,
};

export class UPSAdapter implements CarrierAdapter {
  readonly name = "UPS";

  private config: UPSConfig;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;

  constructor(config: UPSConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox
      ? "https://wwwcie.ups.com/api"
      : "https://onlinetools.ups.com/api";
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      "base64"
    );

    const res = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UPS auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const expiresIn = (data.expires_in ?? 14400) as number; // default 4h
    this.tokenCache = {
      token: data.access_token as string,
      expiresAt: Date.now() + (expiresIn - 60) * 1000, // 1-min buffer
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
        transId: crypto.randomUUID(),
        transactionSrc: process.env.UPS_TRANSACTION_SRC || "ramola-wms",
        ...(options.headers ?? {}),
      },
    });
  }

  // ── Rates ──────────────────────────────────────────────────────────────────

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    const pkg = request.packages[0];
    const body = {
      RateRequest: {
        Request: { SubVersion: "2205", RequestOption: "Shop" },
        Shipment: {
          Shipper: {
            ShipperNumber: this.config.accountNumber,
            Address: {
              AddressLine: [request.from.street1],
              City: request.from.city,
              StateProvinceCode: request.from.state,
              PostalCode: request.from.zip,
              CountryCode: request.from.country,
            },
          },
          ShipTo: {
            Address: {
              AddressLine: [request.to.street1],
              City: request.to.city,
              StateProvinceCode: request.to.state,
              PostalCode: request.to.zip,
              CountryCode: request.to.country,
              ...(request.to.isResidential ? { ResidentialAddressIndicator: "" } : {}),
            },
          },
          ShipFrom: {
            Address: {
              AddressLine: [request.from.street1],
              City: request.from.city,
              StateProvinceCode: request.from.state,
              PostalCode: request.from.zip,
              CountryCode: request.from.country,
            },
          },
          Package: [
            {
              PackagingType: { Code: "02" },
              Dimensions: {
                UnitOfMeasurement: { Code: pkg.dimUnit === "in" ? "IN" : "CM" },
                Length: String(Math.ceil(pkg.length)),
                Width: String(Math.ceil(pkg.width)),
                Height: String(Math.ceil(pkg.height)),
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: pkg.weightUnit === "lb" ? "LBS" : "KGS" },
                Weight: String(pkg.weight.toFixed(1)),
              },
            },
          ],
          ShipmentRatingOptions: { NegotiatedRatesIndicator: "" },
        },
      },
    };

    const res = await this.authedFetch(`${this.baseUrl}/rating/v1/Rate`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UPS rating failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shipments: any[] = Array.isArray(data.RateResponse?.RatedShipment)
      ? data.RateResponse.RatedShipment
      : data.RateResponse?.RatedShipment
        ? [data.RateResponse.RatedShipment]
        : [];

    return shipments.map((s) => {
      const code = s.Service?.Code as string;
      const negotiated = s.NegotiatedRateCharges?.TotalCharge?.MonetaryValue;
      const retail = s.TotalCharges?.MonetaryValue;
      const cost = parseFloat(negotiated ?? retail ?? "0");
      const daysFromResponse = parseInt(s.GuaranteedDelivery?.BusinessDaysInTransit ?? "0");
      const days = daysFromResponse || (UPS_SERVICE_DAYS[code] ?? 5);

      return {
        carrier: "UPS",
        service: UPS_SERVICE_NAMES[code] ?? `UPS Service ${code}`,
        serviceCode: code,
        totalCost: cost,
        currency: s.TotalCharges?.CurrencyCode ?? "USD",
        estimatedDays: days,
        guaranteed: UPS_GUARANTEED[code] ?? false,
      } satisfies RateQuote;
    });
  }

  // ── Label ─────────────────────────────────────────────────────────────────

  async createLabel(request: LabelRequest): Promise<LabelResult> {
    const pkg = request.packages[0];
    const body = {
      ShipmentRequest: {
        Request: { SubVersion: "2205", RequestOption: "nonvalidate" },
        Shipment: {
          Description: "Shipment",
          Shipper: {
            Name: request.from.company || request.from.name,
            ShipperNumber: this.config.accountNumber,
            Address: {
              AddressLine: [request.from.street1],
              City: request.from.city,
              StateProvinceCode: request.from.state,
              PostalCode: request.from.zip,
              CountryCode: request.from.country,
            },
          },
          ShipTo: {
            Name: request.to.name,
            Address: {
              AddressLine: [request.to.street1, request.to.street2].filter(Boolean),
              City: request.to.city,
              StateProvinceCode: request.to.state,
              PostalCode: request.to.zip,
              CountryCode: request.to.country,
              ...(request.to.isResidential ? { ResidentialAddressIndicator: "" } : {}),
            },
            Phone: { Number: request.to.phone ?? "" },
          },
          ShipFrom: {
            Name: request.from.company || request.from.name,
            Address: {
              AddressLine: [request.from.street1],
              City: request.from.city,
              StateProvinceCode: request.from.state,
              PostalCode: request.from.zip,
              CountryCode: request.from.country,
            },
          },
          PaymentInformation: {
            ShipmentCharge: {
              Type: "01",
              BillShipper: { AccountNumber: this.config.accountNumber },
            },
          },
          Service: { Code: request.serviceCode },
          Package: [
            {
              Packaging: { Code: "02" },
              Dimensions: {
                UnitOfMeasurement: { Code: pkg.dimUnit === "in" ? "IN" : "CM" },
                Length: String(Math.ceil(pkg.length)),
                Width: String(Math.ceil(pkg.width)),
                Height: String(Math.ceil(pkg.height)),
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: pkg.weightUnit === "lb" ? "LBS" : "KGS" },
                Weight: String(pkg.weight.toFixed(1)),
              },
              ReferenceNumber: request.reference
                ? { Code: "PO", Value: request.reference }
                : undefined,
            },
          ],
        },
        LabelSpecification: {
          LabelImageFormat: { Code: "PDF" },
          LabelStockSize: { Height: "6", Width: "4" },
        },
      },
    };

    const res = await this.authedFetch(`${this.baseUrl}/shipments/v2205/ship`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UPS ship failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const results = data.ShipmentResponse?.ShipmentResults;
    // PackageResults can be array or single object
    const pkgResults = Array.isArray(results?.PackageResults)
      ? results.PackageResults[0]
      : results?.PackageResults;

    const trackingNumber = pkgResults?.TrackingNumber ?? results?.ShipmentIdentificationNumber;
    const labelData = pkgResults?.ShippingLabel?.GraphicImage ?? "";
    const cost = parseFloat(
      pkgResults?.BaseServiceCharge?.MonetaryValue ??
        results?.ShipmentCharges?.TotalCharges?.MonetaryValue ??
        "0"
    );

    return {
      trackingNumber,
      labelFormat: "PDF",
      labelData,
      totalCost: cost,
      carrier: "UPS",
      service: UPS_SERVICE_NAMES[request.serviceCode] ?? `UPS ${request.serviceCode}`,
    };
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    const url = new URL(`${this.baseUrl}/track/v1/details/${trackingNumber}`);
    url.searchParams.set("locale", "en_US");
    url.searchParams.set("returnSignature", "false");

    const res = await this.authedFetch(url.toString());

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UPS tracking failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0] as any;
    if (!pkg) throw new Error("UPS: no package data in tracking response");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activities: any[] = pkg.activity ?? [];
    const latestActivity = activities[0];
    const statusType = latestActivity?.status?.type ?? "I";
    const status: TrackingResult["status"] =
      statusType === "D" ? "delivered" : statusType === "X" ? "exception" : "in_transit";

    // Parse UPS date "YYYYMMDD" + time "HHmmss" into Date
    function parseUPSDateTime(date: string, time: string): Date {
      if (!date) return new Date();
      const y = parseInt(date.slice(0, 4));
      const mo = parseInt(date.slice(4, 6)) - 1;
      const d = parseInt(date.slice(6, 8));
      const h = time ? parseInt(time.slice(0, 2)) : 0;
      const m = time ? parseInt(time.slice(2, 4)) : 0;
      const s = time ? parseInt(time.slice(4, 6)) : 0;
      return new Date(y, mo, d, h, m, s);
    }

    const events = activities.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => ({
        timestamp: parseUPSDateTime(a.date, a.time),
        status: a.status?.description ?? "Unknown",
        location: [a.location?.address?.city, a.location?.address?.stateProvince]
          .filter(Boolean)
          .join(", "),
        description: a.status?.description ?? "",
      })
    );

    const deliveredAt =
      status === "delivered"
        ? parseUPSDateTime(latestActivity?.date, latestActivity?.time)
        : undefined;

    return {
      trackingNumber,
      carrier: "UPS",
      status,
      ...(deliveredAt ? { deliveredAt } : {}),
      events,
    } as TrackingResult;
  }

  // ── Void ──────────────────────────────────────────────────────────────────

  async voidLabel(trackingNumber: string): Promise<boolean> {
    const res = await this.authedFetch(
      `${this.baseUrl}/shipments/v2205/void/cancel/${trackingNumber}`,
      { method: "DELETE" }
    );

    if (!res.ok) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    return data.VoidShipmentResponse?.SummaryResult?.Status?.Code === "1";
  }
}
