/**
 * EDI Integration Types
 *
 * Standard X12 EDI transaction types used in 3PL/warehouse management:
 * - EDI 940: Warehouse Shipping Order (inbound from customer)
 * - EDI 945: Warehouse Shipping Advice (outbound confirmation to customer)
 * - EDI 856: ASN — Advance Ship Notice (inbound shipment notification)
 * - EDI 944: Warehouse Stock Transfer Receipt (receiving confirmation)
 */

// ---------------------------------------------------------------------------
// Common / Envelope Types
// ---------------------------------------------------------------------------

/** A single EDI segment, e.g. ISA*00*          *00* ... */
export interface EDISegment {
  /** Segment identifier, e.g. "ISA", "GS", "ST", "W06" */
  id: string;
  /** Element values (positional), excluding the segment id */
  elements: string[];
}

/** Represents a fully parsed EDI document with envelope + transaction sets. */
export interface EDIDocument {
  /** ISA interchange control header */
  isa: EDISegment | null;
  /** IEA interchange control trailer */
  iea: EDISegment | null;
  /** GS functional group header */
  gs: EDISegment | null;
  /** GE functional group trailer */
  ge: EDISegment | null;
  /** All transaction sets contained in this interchange */
  transactionSets: EDITransactionSet[];
  /** Separator characters detected from the ISA segment */
  separators: EDISeparators;
}

export interface EDITransactionSet {
  /** ST segment — transaction set header */
  st: EDISegment;
  /** SE segment — transaction set trailer */
  se: EDISegment;
  /** Transaction set identifier code, e.g. "940", "945", "856", "944" */
  type: string;
  /** All segments between ST and SE (inclusive) */
  segments: EDISegment[];
}

export interface EDISeparators {
  /** Element separator — typically "*" */
  element: string;
  /** Sub-element separator — typically ":" */
  subElement: string;
  /** Segment terminator — typically "~" */
  segment: string;
}

/** Result from parseEDI, including any errors encountered. */
export interface EDIParsingResult<T = unknown> {
  success: boolean;
  data: T | null;
  errors: string[];
  /** Raw document structure, always populated on success */
  document: EDIDocument | null;
}

// ---------------------------------------------------------------------------
// EDI 940 — Warehouse Shipping Order
// ---------------------------------------------------------------------------

export interface EDI940Header {
  /** W05 — Shipping Order Identification */
  orderNumber: string;
  /** Depositor (customer) order number */
  depositorOrderNumber: string;
  /** Purchase order number */
  purchaseOrderNumber?: string;
  /** Ship-to name */
  shipToName: string;
  /** Ship-to address */
  shipToAddress: EDIAddress;
  /** Requested ship date (YYYYMMDD) */
  requestedShipDate?: string;
  /** Carrier code */
  carrierCode?: string;
  /** Shipping method */
  shippingMethod?: string;
  /** Special instructions / notes */
  notes?: string;
}

export interface EDI940LineItem {
  /** W04 — Line item detail */
  lineNumber: number;
  /** Item identifier (SKU / UPC / vendor part number) */
  itemNumber: string;
  /** Qualifier for the item number: "SK" = SKU, "UP" = UPC, "VN" = Vendor */
  itemQualifier: "SK" | "UP" | "VN" | string;
  /** Quantity ordered */
  quantityOrdered: number;
  /** Unit of measure: "EA" = each, "CS" = case, "PL" = pallet */
  unitOfMeasure: string;
  /** Lot number */
  lotNumber?: string;
  /** Item description */
  description?: string;
  /** Weight per unit */
  weight?: number;
  /** Weight unit of measure */
  weightUom?: string;
}

export interface EDI940 {
  header: EDI940Header;
  lineItems: EDI940LineItem[];
}

// ---------------------------------------------------------------------------
// EDI 945 — Warehouse Shipping Advice
// ---------------------------------------------------------------------------

export interface EDI945Header {
  /** W06 — Warehouse Shipment Identification */
  shipmentId: string;
  /** Original order number (references the 940) */
  orderNumber: string;
  /** Depositor order number */
  depositorOrderNumber: string;
  /** Actual ship date (YYYYMMDD) */
  shipDate: string;
  /** Carrier tracking / PRO number */
  trackingNumber?: string;
  /** Carrier code */
  carrierCode?: string;
  /** Bill of lading number */
  bolNumber?: string;
  /** Ship-to address */
  shipToAddress?: EDIAddress;
  /** Total weight */
  totalWeight?: number;
  /** Total number of packages */
  totalPackages?: number;
}

export interface EDI945LineItem {
  lineNumber: number;
  itemNumber: string;
  itemQualifier: string;
  quantityShipped: number;
  unitOfMeasure: string;
  lotNumber?: string;
  description?: string;
}

export interface EDI945 {
  header: EDI945Header;
  lineItems: EDI945LineItem[];
}

/** Input data used to generate an EDI 945 document. */
export interface EDI945Data {
  /** ISA sender/receiver identifiers */
  senderId: string;
  receiverId: string;
  /** Control numbers for envelope */
  controlNumber: string;
  groupControlNumber: string;
  transactionControlNumber: string;
  /** Shipment details */
  header: EDI945Header;
  lineItems: EDI945LineItem[];
}

// ---------------------------------------------------------------------------
// EDI 856 — Advance Ship Notice
// ---------------------------------------------------------------------------

export interface EDI856Header {
  /** BSN — Beginning Segment for Ship Notice */
  shipmentId: string;
  /** Shipment date (YYYYMMDD) */
  shipDate: string;
  /** Shipment time (HHMM) */
  shipTime?: string;
  /** Bill of lading number */
  bolNumber?: string;
  /** Carrier SCAC code */
  carrierCode?: string;
  /** Carrier name */
  carrierName?: string;
  /** Ship-from address */
  shipFromAddress?: EDIAddress;
  /** Ship-to address */
  shipToAddress?: EDIAddress;
  /** Estimated delivery date (YYYYMMDD) */
  estimatedDeliveryDate?: string;
}

export interface EDI856Item {
  /** Item number (SKU, UPC, etc.) */
  itemNumber: string;
  itemQualifier: string;
  /** Quantity shipped */
  quantity: number;
  unitOfMeasure: string;
  /** Purchase order reference */
  purchaseOrderNumber?: string;
  /** Lot number */
  lotNumber?: string;
  /** Serial numbers associated with this line */
  serialNumbers?: string[];
  /** Description */
  description?: string;
}

export interface EDI856 {
  header: EDI856Header;
  items: EDI856Item[];
}

// ---------------------------------------------------------------------------
// EDI 944 — Warehouse Stock Transfer Receipt
// ---------------------------------------------------------------------------

export interface EDI944Header {
  /** W17 — Warehouse Receipt Identification */
  receiptId: string;
  /** Reference to the inbound shipment / ASN */
  shipmentId?: string;
  /** Receipt date (YYYYMMDD) */
  receiptDate: string;
  /** Warehouse code */
  warehouseCode?: string;
  /** Depositor / owner */
  depositorCode?: string;
  /** Notes */
  notes?: string;
}

export interface EDI944LineItem {
  lineNumber: number;
  itemNumber: string;
  itemQualifier: string;
  quantityReceived: number;
  unitOfMeasure: string;
  lotNumber?: string;
  /** Damage indicator: "Y" or "N" */
  damaged?: string;
  /** Quantity damaged */
  quantityDamaged?: number;
  description?: string;
}

export interface EDI944 {
  header: EDI944Header;
  lineItems: EDI944LineItem[];
}

/** Input data used to generate an EDI 944 document. */
export interface EDI944Data {
  senderId: string;
  receiverId: string;
  controlNumber: string;
  groupControlNumber: string;
  transactionControlNumber: string;
  header: EDI944Header;
  lineItems: EDI944LineItem[];
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface EDIAddress {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

/** Status for a trading partner configuration. */
export type TradingPartnerStatus = "active" | "inactive" | "testing";

/** Supported EDI transaction set types. */
export type EDITransactionType = "940" | "945" | "856" | "944";

export interface TradingPartner {
  id: string;
  name: string;
  /** ISA qualifier + ID for this partner (e.g. "ZZ" + "ACMECORP") */
  isaQualifier: string;
  isaId: string;
  supportedTransactions: EDITransactionType[];
  status: TradingPartnerStatus;
  /** Communication method for sending/receiving */
  communicationMethod: "sftp" | "as2" | "api" | "email";
  /** Connection endpoint */
  endpoint?: string;
  createdAt: string;
  updatedAt: string;
}
