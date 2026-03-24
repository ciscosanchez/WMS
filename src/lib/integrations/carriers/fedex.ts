/**
 * FedEx Carrier Adapter
 *
 * Uses the FedEx REST API (OAuth 2.0 client credentials) for rating, shipping,
 * tracking, and cancel. Tokens are cached in-memory for their 1-hour TTL.
 *
 * API Documentation: https://developer.fedex.com/api/en-us/catalog.html
 *
 * Required env vars (when live):
 *   FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, FEDEX_ACCOUNT_NUMBER
 */

import type {
  CarrierAdapter,
  RateRequest,
  RateQuote,
  LabelRequest,
  LabelResult,
  TrackingResult,
} from "./types";

export interface FedExConfig {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  useSandbox?: boolean;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

const FEDEX_TRANSIT_DAYS: Record<string, number> = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
  FOUR_DAYS: 4,
  FIVE_DAYS: 5,
  SIX_DAYS: 6,
  SEVEN_DAYS: 7,
  UNKNOWN: 5,
};

const FEDEX_SERVICE_NAMES: Record<string, string> = {
  FEDEX_GROUND: "FedEx Ground",
  FEDEX_EXPRESS_SAVER: "FedEx Express Saver",
  FEDEX_2_DAY: "FedEx 2Day",
  FEDEX_2_DAY_AM: "FedEx 2Day A.M.",
  STANDARD_OVERNIGHT: "FedEx Standard Overnight",
  PRIORITY_OVERNIGHT: "FedEx Priority Overnight",
  FIRST_OVERNIGHT: "FedEx First Overnight",
  FEDEX_FREIGHT_ECONOMY: "FedEx Freight Economy",
  FEDEX_FREIGHT_PRIORITY: "FedEx Freight Priority",
  GROUND_HOME_DELIVERY: "FedEx Home Delivery",
  SMART_POST: "FedEx SmartPost",
};

const FEDEX_EXPRESS_SERVICES = new Set([
  "FEDEX_EXPRESS_SAVER",
  "FEDEX_2_DAY",
  "FEDEX_2_DAY_AM",
  "STANDARD_OVERNIGHT",
  "PRIORITY_OVERNIGHT",
  "FIRST_OVERNIGHT",
]);

export class FedExAdapter implements CarrierAdapter {
  readonly name = "FedEx";

  private config: FedExConfig;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;

  constructor(config: FedExConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox ? "https://apis-sandbox.fedex.com" : "https://apis.fedex.com";
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

    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FedEx auth failed (${res.status}): ${text}`);
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
        "X-locale": "en_US",
        ...(options.headers ?? {}),
      },
    });
  }

  // ── Rates ──────────────────────────────────────────────────────────────────

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    const pkg = request.packages[0];
    const body = {
      accountNumber: { value: this.config.accountNumber },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: request.from.zip,
            countryCode: request.from.country,
            stateOrProvinceCode: request.from.state,
            city: request.from.city,
          },
        },
        recipient: {
          address: {
            postalCode: request.to.zip,
            countryCode: request.to.country,
            stateOrProvinceCode: request.to.state,
            city: request.to.city,
            residential: request.to.isResidential ?? false,
          },
        },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {
            weight: {
              units: pkg.weightUnit === "lb" ? "LB" : "KG",
              value: pkg.weight,
            },
            dimensions: {
              length: Math.ceil(pkg.length),
              width: Math.ceil(pkg.width),
              height: Math.ceil(pkg.height),
              units: pkg.dimUnit === "in" ? "IN" : "CM",
            },
          },
        ],
      },
    };

    const res = await this.authedFetch(`${this.baseUrl}/rate/v1/rates/quotes`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FedEx rating failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details: any[] = data.output?.rateReplyDetails ?? [];

    return details.flatMap((detail) => {
      const serviceType = detail.serviceType as string;
      const transitTime = detail.operationalDetail?.transitTime as string | undefined;
      const days = FEDEX_TRANSIT_DAYS[transitTime ?? "UNKNOWN"] ?? 5;

      // Prefer ACCOUNT rates, fall back to LIST
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ratedDetails: any[] = detail.ratedShipmentDetails ?? [];
      const accountRate = ratedDetails.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r.rateType === "ACCOUNT"
      );
      const listRate = ratedDetails.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r.rateType === "PAYOR_LIST_SHIPMENT" || r.rateType === "LIST"
      );
      const rateDetail = accountRate ?? listRate ?? ratedDetails[0];
      if (!rateDetail) return [];

      const cost = parseFloat(
        rateDetail.totalNetFedExCharge?.amount ?? rateDetail.totalNetCharge?.amount ?? "0"
      );

      return [
        {
          carrier: "FedEx",
          service: FEDEX_SERVICE_NAMES[serviceType] ?? serviceType,
          serviceCode: serviceType,
          totalCost: cost,
          currency: rateDetail.totalNetCharge?.currency ?? "USD",
          estimatedDays: days,
          guaranteed: FEDEX_EXPRESS_SERVICES.has(serviceType),
        } satisfies RateQuote,
      ];
    });
  }

  // ── Label ─────────────────────────────────────────────────────────────────

  async createLabel(request: LabelRequest): Promise<LabelResult> {
    const pkg = request.packages[0];
    const body = {
      accountNumber: { value: this.config.accountNumber },
      labelResponseOptions: "LABEL",
      requestedShipment: {
        shipper: {
          contact: {
            personName: request.from.name,
            companyName: request.from.company,
            phoneNumber: request.from.phone ?? "",
          },
          address: {
            streetLines: [request.from.street1, request.from.street2].filter(Boolean),
            city: request.from.city,
            stateOrProvinceCode: request.from.state,
            postalCode: request.from.zip,
            countryCode: request.from.country,
          },
        },
        recipients: [
          {
            contact: {
              personName: request.to.name,
              companyName: request.to.company ?? "",
              phoneNumber: request.to.phone ?? "",
            },
            address: {
              streetLines: [request.to.street1, request.to.street2].filter(Boolean),
              city: request.to.city,
              stateOrProvinceCode: request.to.state,
              postalCode: request.to.zip,
              countryCode: request.to.country,
              residential: request.to.isResidential ?? false,
            },
          },
        ],
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType: request.serviceCode,
        packagingType: "YOUR_PACKAGING",
        shippingChargesPayment: {
          paymentType: "SENDER",
          payor: {
            responsibleParty: {
              accountNumber: { value: this.config.accountNumber },
            },
          },
        },
        labelSpecification: {
          labelFormatType: "COMMON2D",
          imageType: "PDF",
          labelStockType: "PAPER_4X6",
        },
        requestedPackageLineItems: [
          {
            weight: {
              units: pkg.weightUnit === "lb" ? "LB" : "KG",
              value: pkg.weight,
            },
            dimensions: {
              length: Math.ceil(pkg.length),
              width: Math.ceil(pkg.width),
              height: Math.ceil(pkg.height),
              units: pkg.dimUnit === "in" ? "IN" : "CM",
            },
            ...(request.reference
              ? {
                  customerReferences: [
                    { customerReferenceType: "CUSTOMER_REFERENCE", value: request.reference },
                  ],
                }
              : {}),
          },
        ],
      },
    };

    const res = await this.authedFetch(`${this.baseUrl}/ship/v1/shipments`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FedEx ship failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shipment = data.output?.transactionShipments?.[0] as any;
    const piece = shipment?.pieceResponses?.[0];
    const trackingNumber = piece?.trackingNumber ?? shipment?.masterTrackingNumber;

    // Label may be in packageDocuments or completedShipmentDetail
    const labelDoc = piece?.packageDocuments?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d: any) => d.contentType === "LABEL"
    );
    const labelData =
      labelDoc?.encodedLabel ??
      shipment?.completedShipmentDetail?.completedPackageDetails?.[0]?.label?.encodedLabel ??
      "";

    const cost = parseFloat(
      shipment?.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.[0]?.totalNetCharge
        ?.amount ?? "0"
    );

    return {
      trackingNumber,
      labelFormat: "PDF",
      labelData,
      totalCost: cost,
      carrier: "FedEx",
      service: FEDEX_SERVICE_NAMES[request.serviceCode] ?? request.serviceCode,
    };
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    const body = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber,
            carrierCode: "FDXE",
            trackingNumberUniqueId: "",
          },
        },
      ],
    };

    const res = await this.authedFetch(`${this.baseUrl}/track/v1/trackingnumbers`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FedEx tracking failed (${res.status}): ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const trackResult = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!trackResult) throw new Error("FedEx: no track result in response");

    const derivedCode = trackResult.latestStatusDetail?.derivedCode as string | undefined;
    const status: TrackingResult["status"] =
      derivedCode === "DL"
        ? "delivered"
        : derivedCode === "OC" || derivedCode === "DE"
          ? "exception"
          : "in_transit";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanEvents: any[] = trackResult.scanEvents ?? [];
    const events = scanEvents.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        timestamp: new Date(s.date),
        status: s.derivedStatus ?? s.eventType ?? "Unknown",
        location: [s.scanLocation?.city, s.scanLocation?.stateOrProvinceCode]
          .filter(Boolean)
          .join(", "),
        description: s.eventDescription ?? "",
      })
    );

    // Find actual delivery timestamp
    const deliveryTime = trackResult.dateAndTimes?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dt: any) => dt.type === "ACTUAL_DELIVERY"
    )?.dateTime;

    const estimatedTime = trackResult.estimatedDeliveryTimeWindow?.window?.begins;

    return {
      trackingNumber,
      carrier: "FedEx",
      status,
      ...(status === "delivered" && deliveryTime ? { deliveredAt: new Date(deliveryTime) } : {}),
      ...(estimatedTime ? { estimatedDelivery: new Date(estimatedTime) } : {}),
      events,
    } as TrackingResult;
  }

  // ── Void ──────────────────────────────────────────────────────────────────

  async voidLabel(trackingNumber: string): Promise<boolean> {
    const body = {
      accountNumber: { value: this.config.accountNumber },
      senderCountryCode: "US",
      deletionControl: "DELETE_ALL_PACKAGES",
      trackingNumber,
    };

    const res = await this.authedFetch(`${this.baseUrl}/ship/v1/shipments/cancel`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (!res.ok) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    return data.output?.cancelledShipment === true;
  }
}
