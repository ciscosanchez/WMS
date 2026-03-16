/**
 * USPS Carrier Adapter
 *
 * Implements the CarrierAdapter interface for USPS shipping services.
 * Uses the USPS Web Tools API (XML-based) and the newer USPS REST API v3.
 *
 * API Documentation:
 *   Legacy: https://www.usps.com/business/web-tools-apis/
 *   REST v3: https://developer.usps.com/api/81
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
  userId: string;
  useSandbox?: boolean;
}

export class USPSAdapter implements CarrierAdapter {
  readonly name = "USPS";

  private config: USPSConfig;
  private baseUrl: string;

  constructor(config: USPSConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox
      ? "https://secure.shippingapis.com/ShippingAPITest.dll"
      : "https://secure.shippingapis.com/ShippingAPI.dll";
  }

  /**
   * Get shipping rates from USPS Domestic Rate Calculator.
   *
   * Legacy XML API:
   *   Endpoint: GET {baseUrl}?API=RateV4&XML={xml}
   *   XML structure:
   *   <RateV4Request USERID="{userId}">
   *     <Revision>2</Revision>
   *     <Package ID="0">
   *       <Service>ALL</Service>
   *       <ZipOrigination>{fromZip}</ZipOrigination>
   *       <ZipDestination>{toZip}</ZipDestination>
   *       <Pounds>{pounds}</Pounds>
   *       <Ounces>{ounces}</Ounces>
   *       <Container>VARIABLE</Container>
   *       <Width>{width}</Width>
   *       <Length>{length}</Length>
   *       <Height>{height}</Height>
   *       <Machinable>TRUE</Machinable>
   *     </Package>
   *   </RateV4Request>
   *
   * REST v3 API:
   *   Endpoint: POST https://api.usps.com/prices/v3/total-rates/search
   *   Headers: Authorization: Bearer {accessToken}
   *   Body: {
   *     originZIPCode, destinationZIPCode,
   *     weight, length, width, height,
   *     mailClass: "ALL", processingCategory: "MACHINABLE",
   *     rateIndicator: "DR", destinationEntryFacilityType: "NONE",
   *     priceType: "RETAIL"
   *   }
   *
   * Mail Classes: USPS_GROUND_ADVANTAGE, PRIORITY_MAIL, PRIORITY_MAIL_EXPRESS,
   *   FIRST_CLASS_MAIL, PARCEL_SELECT, MEDIA_MAIL
   */
  async getRates(request: RateRequest): Promise<RateQuote[]> {
    // TODO: Replace mock with real USPS rate API call
    // TODO: Build XML request or REST v3 request from `request` parameter
    // TODO: Parse rate response into RateQuote[]

    const _xmlRequest = `
      <RateV4Request USERID="${this.config.userId}">
        <Revision>2</Revision>
        ${request.packages
          .map(
            (pkg, i) => `
        <Package ID="${i}">
          <Service>ALL</Service>
          <ZipOrigination>${request.from.zip}</ZipOrigination>
          <ZipDestination>${request.to.zip}</ZipDestination>
          <Pounds>${Math.floor(pkg.weight)}</Pounds>
          <Ounces>${Math.round((pkg.weight % 1) * 16)}</Ounces>
          <Container>VARIABLE</Container>
          <Width>${pkg.width}</Width>
          <Length>${pkg.length}</Length>
          <Height>${pkg.height}</Height>
          <Machinable>TRUE</Machinable>
        </Package>`
          )
          .join("")}
      </RateV4Request>`;

    // Mock response — realistic USPS rates
    return [
      {
        carrier: "USPS",
        service: "USPS Ground Advantage",
        serviceCode: "USPS_GROUND_ADVANTAGE",
        totalCost: 5.25,
        currency: "USD",
        estimatedDays: 5,
        guaranteed: false,
      },
      {
        carrier: "USPS",
        service: "USPS Priority Mail",
        serviceCode: "PRIORITY_MAIL",
        totalCost: 7.9,
        currency: "USD",
        estimatedDays: 2,
        guaranteed: false,
      },
      {
        carrier: "USPS",
        service: "USPS Priority Mail Express",
        serviceCode: "PRIORITY_MAIL_EXPRESS",
        totalCost: 26.35,
        currency: "USD",
        estimatedDays: 1,
        guaranteed: true,
      },
    ];
  }

  /**
   * Create a shipping label via USPS eVS Label API.
   *
   * Legacy XML API:
   *   Endpoint: GET {baseUrl}?API=eVS&XML={xml}
   *   XML: <eVSRequest USERID="{userId}">
   *     <Option />
   *     <Revision>2</Revision>
   *     <ImageParameters><ImageParameter>4x6LABELL</ImageParameter></ImageParameters>
   *     <FromName>{name}</FromName>
   *     <FromFirm>{company}</FromFirm>
   *     <FromAddress1>{street2}</FromAddress1>
   *     <FromAddress2>{street1}</FromAddress2>
   *     <FromCity>{city}</FromCity>
   *     <FromState>{state}</FromState>
   *     <FromZip5>{zip5}</FromZip5>
   *     <ToName>{name}</ToName>
   *     <ToAddress1>{street2}</ToAddress1>
   *     <ToAddress2>{street1}</ToAddress2>
   *     <ToCity>{city}</ToCity>
   *     <ToState>{state}</ToState>
   *     <ToZip5>{zip5}</ToZip5>
   *     <WeightInOunces>{ounces}</WeightInOunces>
   *     <ServiceType>{serviceCode}</ServiceType>
   *     <ImageType>PDF</ImageType>
   *   </eVSRequest>
   *
   * REST v3 API:
   *   Endpoint: POST https://api.usps.com/labels/v3/label
   *   Body: { imageInfo, fromAddress, toAddress, packageDescription, mailClass }
   */
  async createLabel(request: LabelRequest): Promise<LabelResult> {
    // TODO: Replace mock with real USPS eVS or REST v3 label API call
    // TODO: Build XML or REST request from `request` parameter
    // TODO: Parse response for tracking number and base64 label image

    // Mock response — realistic USPS label
    const mockTrackingNumber = `9400${Date.now().toString().slice(-16).padStart(16, "0")}`;

    return {
      trackingNumber: mockTrackingNumber,
      labelFormat: "PDF",
      labelData: "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+Pg==", // mock base64 PDF
      totalCost: 5.25,
      carrier: "USPS",
      service: `USPS ${request.serviceCode}`,
    };
  }

  /**
   * Get tracking information from USPS Track API.
   *
   * Legacy XML API:
   *   Endpoint: GET {baseUrl}?API=TrackV2&XML={xml}
   *   XML: <TrackFieldRequest USERID="{userId}">
   *     <Revision>1</Revision>
   *     <ClientIp>127.0.0.1</ClientIp>
   *     <SourceId>armstrong-wms</SourceId>
   *     <TrackID ID="{trackingNumber}" />
   *   </TrackFieldRequest>
   *
   * REST v3 API:
   *   Endpoint: GET https://api.usps.com/tracking/v3/tracking/{trackingNumber}?expand=DETAIL
   *   Headers: Authorization: Bearer {accessToken}
   *
   * Response contains TrackDetail elements with:
   *   EventDate, EventTime, Event, EventCity, EventState, EventCountry
   */
  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    // TODO: Replace mock with real USPS Track API call
    // TODO: Build XML or REST request
    // TODO: Parse TrackDetail elements into TrackingEvent[]

    const _xmlRequest = `
      <TrackFieldRequest USERID="${this.config.userId}">
        <Revision>1</Revision>
        <ClientIp>127.0.0.1</ClientIp>
        <SourceId>armstrong-wms</SourceId>
        <TrackID ID="${trackingNumber}" />
      </TrackFieldRequest>`;

    const now = new Date();

    // Mock response — realistic USPS tracking
    return {
      trackingNumber,
      carrier: "USPS",
      status: "in_transit",
      estimatedDelivery: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      events: [
        {
          timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          status: "In Transit",
          location: "DISTRIBUTION CENTER, Atlanta, GA",
          description: "In Transit to Next Facility",
        },
        {
          timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000),
          status: "In Transit",
          location: "USPS REGIONAL FACILITY, Charlotte, NC",
          description: "Departed USPS Regional Facility",
        },
        {
          timestamp: new Date(now.getTime() - 28 * 60 * 60 * 1000),
          status: "Accepted",
          location: "POST OFFICE, Miami, FL",
          description: "Accepted at USPS Origin Facility",
        },
      ],
    };
  }

  /**
   * Void/refund a USPS shipping label.
   *
   * Legacy XML API:
   *   Endpoint: GET {baseUrl}?API=eVSCancel&XML={xml}
   *   XML: <eVSCancelRequest USERID="{userId}">
   *     <BarcodeNumber>{trackingNumber}</BarcodeNumber>
   *   </eVSCancelRequest>
   *
   * REST v3 API:
   *   Endpoint: DELETE https://api.usps.com/labels/v3/label/{trackingNumber}
   *   Headers: Authorization: Bearer {accessToken}
   *
   * Note: USPS labels can only be voided within 24 hours of creation.
   */
  async voidLabel(trackingNumber: string): Promise<boolean> {
    // TODO: Replace mock with real USPS void/cancel API call
    // TODO: Build XML or REST request
    // TODO: Check response for successful cancellation

    const _xmlRequest = `
      <eVSCancelRequest USERID="${this.config.userId}">
        <BarcodeNumber>${trackingNumber}</BarcodeNumber>
      </eVSCancelRequest>`;

    return true;
  }
}
