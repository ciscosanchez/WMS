/**
 * Carrier Integration Types
 *
 * Unified types for multi-carrier rate shopping, label generation, and tracking.
 * Each carrier adapter (UPS, FedEx, USPS) implements the CarrierAdapter interface.
 */

export interface ShipmentPackage {
  weight: number;
  weightUnit: "lb" | "kg";
  length: number;
  width: number;
  height: number;
  dimUnit: "in" | "cm";
}

export interface ShipFromAddress {
  name: string;
  company: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

export interface ShipToAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface RateRequest {
  from: ShipFromAddress;
  to: ShipToAddress;
  packages: ShipmentPackage[];
  serviceLevel?: "ground" | "express" | "overnight" | "economy";
}

export interface RateQuote {
  carrier: string;
  service: string;
  serviceCode: string;
  totalCost: number;
  currency: string;
  estimatedDays: number;
  guaranteed: boolean;
}

export interface LabelRequest {
  from: ShipFromAddress;
  to: ShipToAddress;
  packages: ShipmentPackage[];
  serviceCode: string;
  reference?: string;
}

export interface LabelResult {
  trackingNumber: string;
  labelFormat: "PDF" | "PNG" | "ZPL";
  labelData: string; // base64 encoded
  totalCost: number;
  carrier: string;
  service: string;
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  location: string;
  description: string;
}

export interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  status: "in_transit" | "delivered" | "exception" | "unknown";
  estimatedDelivery?: Date;
  events: TrackingEvent[];
}

/**
 * All carrier adapters implement this interface.
 * This allows rate shopping across carriers with a single API.
 */
export interface CarrierAdapter {
  name: string;
  getRates(request: RateRequest): Promise<RateQuote[]>;
  createLabel(request: LabelRequest): Promise<LabelResult>;
  getTracking(trackingNumber: string): Promise<TrackingResult>;
  voidLabel(trackingNumber: string): Promise<boolean>;
}
