/**
 * FedEx Carrier Adapter
 *
 * Implements the CarrierAdapter interface for FedEx shipping services.
 * Uses the FedEx REST API (OAuth 2.0 client credentials) for rating, shipping, tracking, and void.
 *
 * API Documentation: https://developer.fedex.com/api/en-us/catalog.html
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

export class FedExAdapter implements CarrierAdapter {
  readonly name = "FedEx";

  private config: FedExConfig;
  private baseUrl: string;

  constructor(config: FedExConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox
      ? "https://apis-sandbox.fedex.com"
      : "https://apis.fedex.com";
  }

  /**
   * Get shipping rates from FedEx Rate Quotes API.
   *
   * Auth: POST {baseUrl}/oauth/token
   *   grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
   *
   * Endpoint: POST {baseUrl}/rate/v1/rates/quotes
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   X-locale: "en_US"
   *
   * Request body structure:
   * {
   *   accountNumber: { value: "{accountNumber}" },
   *   requestedShipment: {
   *     shipper: { address: { postalCode, countryCode, stateOrProvinceCode, city } },
   *     recipient: { address: { postalCode, countryCode, stateOrProvinceCode, city, residential } },
   *     pickupType: "DROPOFF_AT_FEDEX_LOCATION",
   *     rateRequestType: ["ACCOUNT", "LIST"],
   *     requestedPackageLineItems: [{
   *       weight: { units: "LB", value },
   *       dimensions: { length, width, height, units: "IN" }
   *     }]
   *   }
   * }
   *
   * Service Types: FEDEX_GROUND, FEDEX_EXPRESS_SAVER, PRIORITY_OVERNIGHT,
   *   STANDARD_OVERNIGHT, FEDEX_2_DAY, FIRST_OVERNIGHT, FEDEX_FREIGHT_ECONOMY
   */
  async getRates(request: RateRequest): Promise<RateQuote[]> {
    // TODO: Replace mock with real FedEx Rate Quotes API call
    // TODO: Obtain OAuth token via POST /oauth/token with client credentials
    // TODO: Build requestedShipment from `request` parameter
    // TODO: Parse rateReplyDetails[].ratedShipmentDetails[].totalNetCharge into RateQuote[]

    const _endpoint = `${this.baseUrl}/rate/v1/rates/quotes`;
    const _requestBody = {
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
        requestedPackageLineItems: request.packages.map((pkg) => ({
          weight: {
            units: pkg.weightUnit === "lb" ? "LB" : "KG",
            value: pkg.weight,
          },
          dimensions: {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            units: pkg.dimUnit === "in" ? "IN" : "CM",
          },
        })),
      },
    };

    // Mock response — realistic FedEx rates
    return [
      {
        carrier: "FedEx",
        service: "FedEx Ground",
        serviceCode: "FEDEX_GROUND",
        totalCost: 9.25,
        currency: "USD",
        estimatedDays: 5,
        guaranteed: false,
      },
      {
        carrier: "FedEx",
        service: "FedEx Express Saver",
        serviceCode: "FEDEX_EXPRESS_SAVER",
        totalCost: 16.75,
        currency: "USD",
        estimatedDays: 3,
        guaranteed: true,
      },
      {
        carrier: "FedEx",
        service: "FedEx Priority Overnight",
        serviceCode: "PRIORITY_OVERNIGHT",
        totalCost: 35.5,
        currency: "USD",
        estimatedDays: 1,
        guaranteed: true,
      },
    ];
  }

  /**
   * Create a shipping label via FedEx Ship API.
   *
   * Endpoint: POST {baseUrl}/ship/v1/shipments
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   X-locale: "en_US"
   *
   * Request body structure:
   * {
   *   accountNumber: { value: "{accountNumber}" },
   *   labelResponseOptions: "LABEL",
   *   requestedShipment: {
   *     shipper: { contact: { personName, companyName, phoneNumber }, address: { ... } },
   *     recipients: [{ contact: { personName, companyName, phoneNumber }, address: { ... } }],
   *     pickupType: "DROPOFF_AT_FEDEX_LOCATION",
   *     serviceType: "{serviceCode}",
   *     packagingType: "YOUR_PACKAGING",
   *     shippingChargesPayment: {
   *       paymentType: "SENDER",
   *       payor: { responsibleParty: { accountNumber: { value: "{accountNumber}" } } }
   *     },
   *     labelSpecification: {
   *       labelFormatType: "COMMON2D",
   *       imageType: "PDF",
   *       labelStockType: "PAPER_4X6"
   *     },
   *     requestedPackageLineItems: [{ weight: { ... }, dimensions: { ... } }],
   *     shipmentSpecialServices: { specialServiceTypes: [] }
   *   }
   * }
   */
  async createLabel(request: LabelRequest): Promise<LabelResult> {
    // TODO: Replace mock with real FedEx Ship API call
    // TODO: Obtain OAuth token via client credentials
    // TODO: Build requestedShipment from `request` parameter
    // TODO: Parse response for tracking number and base64 label

    const _endpoint = `${this.baseUrl}/ship/v1/shipments`;

    // Mock response — realistic FedEx label
    const mockTrackingNumber = `7489${Date.now().toString().slice(-8)}0000`;

    return {
      trackingNumber: mockTrackingNumber,
      labelFormat: "PDF",
      labelData: "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+Pg==", // mock base64 PDF
      totalCost: 9.25,
      carrier: "FedEx",
      service: `FedEx ${request.serviceCode}`,
    };
  }

  /**
   * Get tracking information from FedEx Track API.
   *
   * Endpoint: POST {baseUrl}/track/v1/trackingnumbers
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   X-locale: "en_US"
   *
   * Request body structure:
   * {
   *   includeDetailedScans: true,
   *   trackingInfo: [{
   *     trackingNumberInfo: {
   *       trackingNumber: "{trackingNumber}",
   *       carrierCode: "FDXE",
   *       trackingNumberUniqueId: ""
   *     }
   *   }]
   * }
   *
   * Response: completeTrackResults[0].trackResults[0].scanEvents[]
   * Each scan: { date, derivedStatus, scanLocation.city, eventDescription }
   */
  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    // TODO: Replace mock with real FedEx Track API call
    // TODO: Obtain OAuth token
    // TODO: Parse completeTrackResults[0].trackResults[0].scanEvents[] into TrackingEvent[]

    const _endpoint = `${this.baseUrl}/track/v1/trackingnumbers`;

    const now = new Date();

    // Mock response — realistic FedEx tracking
    return {
      trackingNumber,
      carrier: "FedEx",
      status: "in_transit",
      estimatedDelivery: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      events: [
        {
          timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
          status: "In Transit",
          location: "Indianapolis, IN",
          description: "In transit to destination",
        },
        {
          timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000),
          status: "In Transit",
          location: "Memphis, TN",
          description: "Departed FedEx hub",
        },
        {
          timestamp: new Date(now.getTime() - 20 * 60 * 60 * 1000),
          status: "Picked Up",
          location: "Dallas, TX",
          description: "Picked up",
        },
      ],
    };
  }

  /**
   * Void/cancel a shipping label via FedEx Ship API.
   *
   * Endpoint: PUT {baseUrl}/ship/v1/shipments/cancel
   * Headers:
   *   Authorization: Bearer {accessToken}
   *   Content-Type: application/json
   *   X-locale: "en_US"
   *
   * Request body:
   * {
   *   accountNumber: { value: "{accountNumber}" },
   *   senderCountryCode: "US",
   *   deletionControl: "DELETE_ALL_PACKAGES",
   *   trackingNumber: "{trackingNumber}"
   * }
   *
   * Response: cancelledShipment === true means success
   */
  async voidLabel(trackingNumber: string): Promise<boolean> {
    // TODO: Replace mock with real FedEx cancel API call
    // TODO: Obtain OAuth token
    // TODO: Check cancelledShipment in response

    const _endpoint = `${this.baseUrl}/ship/v1/shipments/cancel`;
    const _requestBody = {
      accountNumber: { value: this.config.accountNumber },
      senderCountryCode: "US",
      deletionControl: "DELETE_ALL_PACKAGES",
      trackingNumber,
    };

    return true;
  }
}
