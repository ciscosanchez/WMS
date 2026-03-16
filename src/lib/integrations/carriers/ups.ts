/**
 * UPS Carrier Adapter
 *
 * Implements the CarrierAdapter interface for UPS shipping services.
 * Uses the UPS REST API (OAuth 2.0) for rating, shipping, tracking, and void.
 *
 * API Documentation: https://developer.ups.com/api/reference
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
  accessKey: string;
  userId: string;
  password: string;
  useSandbox?: boolean;
}

export class UPSAdapter implements CarrierAdapter {
  readonly name = "UPS";

  private config: UPSConfig;
  private baseUrl: string;

  constructor(config: UPSConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox
      ? "https://wwwcie.ups.com/api"
      : "https://onlinetools.ups.com/api";
  }

  /**
   * Get shipping rates from UPS Rating API.
   *
   * Endpoint: POST {baseUrl}/rating/v1/Rate
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   transId: {uuid}
   *   transactionSrc: "armstrong-wms"
   *
   * Request body structure:
   * {
   *   RateRequest: {
   *     Request: { SubVersion: "2205" },
   *     Shipment: {
   *       Shipper: {
   *         ShipperNumber: "{accountNumber}",
   *         Address: { AddressLine, City, StateProvinceCode, PostalCode, CountryCode }
   *       },
   *       ShipTo: {
   *         Address: { AddressLine, City, StateProvinceCode, PostalCode, CountryCode, ResidentialAddressIndicator }
   *       },
   *       ShipFrom: {
   *         Address: { AddressLine, City, StateProvinceCode, PostalCode, CountryCode }
   *       },
   *       Package: [{
   *         PackagingType: { Code: "02" },  // Customer Supplied
   *         Dimensions: { UnitOfMeasurement: { Code: "IN" }, Length, Width, Height },
   *         PackageWeight: { UnitOfMeasurement: { Code: "LBS" }, Weight }
   *       }],
   *       Service: { Code: "03" }  // Optional: filter to specific service
   *     }
   *   }
   * }
   *
   * Service Codes: 03=Ground, 02=2nd Day Air, 01=Next Day Air, 12=3 Day Select, 14=Next Day Air Early
   */
  async getRates(request: RateRequest): Promise<RateQuote[]> {
    // TODO: Replace mock with real UPS Rating API call
    // TODO: Obtain OAuth token via POST /security/v1/oauth/token
    // TODO: Build request body from `request` parameter using structure above
    // TODO: Parse RateResponse.RatedShipment[] into RateQuote[]

    const _endpoint = `${this.baseUrl}/rating/v1/Rate`;
    const _requestBody = {
      RateRequest: {
        Request: { SubVersion: "2205" },
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
          Package: request.packages.map((pkg) => ({
            PackagingType: { Code: "02" },
            Dimensions: {
              UnitOfMeasurement: { Code: pkg.dimUnit === "in" ? "IN" : "CM" },
              Length: String(pkg.length),
              Width: String(pkg.width),
              Height: String(pkg.height),
            },
            PackageWeight: {
              UnitOfMeasurement: {
                Code: pkg.weightUnit === "lb" ? "LBS" : "KGS",
              },
              Weight: String(pkg.weight),
            },
          })),
        },
      },
    };

    // Mock response — realistic UPS rates
    return [
      {
        carrier: "UPS",
        service: "UPS Ground",
        serviceCode: "03",
        totalCost: 8.95,
        currency: "USD",
        estimatedDays: 5,
        guaranteed: false,
      },
      {
        carrier: "UPS",
        service: "UPS 2nd Day Air",
        serviceCode: "02",
        totalCost: 18.5,
        currency: "USD",
        estimatedDays: 2,
        guaranteed: true,
      },
      {
        carrier: "UPS",
        service: "UPS Next Day Air",
        serviceCode: "01",
        totalCost: 32.0,
        currency: "USD",
        estimatedDays: 1,
        guaranteed: true,
      },
    ];
  }

  /**
   * Create a shipping label via UPS Shipping API.
   *
   * Endpoint: POST {baseUrl}/shipments/v2205/ship
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   transId: {uuid}
   *   transactionSrc: "armstrong-wms"
   *
   * Request body structure:
   * {
   *   ShipmentRequest: {
   *     Request: { SubVersion: "2205" },
   *     Shipment: {
   *       Description: "Shipment",
   *       Shipper: { Name, ShipperNumber, Address: {...} },
   *       ShipTo: { Name, Address: {...} },
   *       ShipFrom: { Name, Address: {...} },
   *       PaymentInformation: {
   *         ShipmentCharge: { Type: "01", BillShipper: { AccountNumber } }
   *       },
   *       Service: { Code: "{serviceCode}" },
   *       Package: [{
   *         Packaging: { Code: "02" },
   *         Dimensions: { ... },
   *         PackageWeight: { ... }
   *       }],
   *       ReferenceNumber: { Value: "{reference}" }
   *     },
   *     LabelSpecification: {
   *       LabelImageFormat: { Code: "PDF" },
   *       LabelStockSize: { Height: "6", Width: "4" }
   *     }
   *   }
   * }
   */
  async createLabel(request: LabelRequest): Promise<LabelResult> {
    // TODO: Replace mock with real UPS Shipping API call
    // TODO: Obtain OAuth token via POST /security/v1/oauth/token
    // TODO: Build ShipmentRequest from `request` parameter
    // TODO: Parse response for tracking number and base64 label image

    const _endpoint = `${this.baseUrl}/shipments/v2205/ship`;

    // Mock response — realistic UPS label
    const mockTrackingNumber = `1Z${this.config.accountNumber.slice(0, 6)}0${Date.now().toString().slice(-9)}`;

    return {
      trackingNumber: mockTrackingNumber,
      labelFormat: "PDF",
      labelData: "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+Pg==", // mock base64 PDF
      totalCost: 8.95,
      carrier: "UPS",
      service: `UPS Service ${request.serviceCode}`,
    };
  }

  /**
   * Get tracking information from UPS Tracking API.
   *
   * Endpoint: GET {baseUrl}/track/v1/details/{trackingNumber}
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   transId: {uuid}
   *   transactionSrc: "armstrong-wms"
   *
   * Query params:
   *   locale: "en_US"
   *   returnSignature: "false"
   *
   * Response contains: trackResponse.shipment[0].package[0].activity[]
   * Each activity: { date, time, location.address, status.type, status.description }
   */
  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    // TODO: Replace mock with real UPS Tracking API call
    // TODO: Obtain OAuth token
    // TODO: Parse trackResponse.shipment[0].package[0].activity[] into TrackingEvent[]

    const _endpoint = `${this.baseUrl}/track/v1/details/${trackingNumber}`;

    const now = new Date();

    // Mock response — realistic UPS tracking
    return {
      trackingNumber,
      carrier: "UPS",
      status: "in_transit",
      estimatedDelivery: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      events: [
        {
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          status: "In Transit",
          location: "Memphis, TN",
          description: "Departed from facility",
        },
        {
          timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          status: "In Transit",
          location: "Louisville, KY",
          description: "Arrived at UPS hub",
        },
        {
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          status: "Picked Up",
          location: "Chicago, IL",
          description: "Shipment picked up",
        },
      ],
    };
  }

  /**
   * Void a shipping label via UPS Void API.
   *
   * Endpoint: DELETE {baseUrl}/shipments/v2205/void/cancel/{trackingNumber}
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   transId: {uuid}
   *   transactionSrc: "armstrong-wms"
   *
   * Response: VoidShipmentResponse.SummaryResult.Status.Code === "1" means success
   */
  async voidLabel(trackingNumber: string): Promise<boolean> {
    // TODO: Replace mock with real UPS Void API call
    // TODO: Obtain OAuth token
    // TODO: Check response SummaryResult.Status.Code === "1"

    const _endpoint = `${this.baseUrl}/shipments/v2205/void/cancel/${trackingNumber}`;

    return true;
  }
}
