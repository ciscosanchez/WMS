/**
 * EDI Parser
 *
 * Parses raw X12 EDI text into structured data. Handles the standard
 * envelope structure (ISA/GS/ST...SE/GE/IEA) and provides specific
 * parsers for 940 (Warehouse Shipping Order) and 856 (ASN) transaction sets.
 *
 * EDI format overview:
 *   - Segments are terminated by "~" (configurable, detected from ISA)
 *   - Elements within a segment are separated by "*"
 *   - Sub-elements are separated by ":" (ISA position 105)
 *   - The ISA segment is always exactly 106 characters, which lets us
 *     detect the separators reliably.
 */

import type {
  EDIDocument,
  EDISegment,
  EDISeparators,
  EDITransactionSet,
  EDIParsingResult,
  EDI940,
  EDI940Header,
  EDI940LineItem,
  EDI856,
  EDI856Header,
  EDI856Item,
  EDIAddress,
} from "./types";

// ---------------------------------------------------------------------------
// Separator Detection
// ---------------------------------------------------------------------------

/**
 * Detect element separator, sub-element separator, and segment terminator
 * from the raw EDI string. The ISA segment is fixed-length (106 chars):
 *   - Position 3 = element separator (typically "*")
 *   - Position 104 = sub-element separator (typically ":")
 *   - Position 105 = segment terminator (typically "~")
 */
function detectSeparators(raw: string): EDISeparators {
  // Default separators if we can't detect
  const defaults: EDISeparators = {
    element: "*",
    subElement: ":",
    segment: "~",
  };

  if (!raw || raw.length < 106) {
    return defaults;
  }

  // The ISA segment must start at position 0
  if (!raw.startsWith("ISA")) {
    return defaults;
  }

  return {
    element: raw[3], // Character after "ISA" is the element separator
    subElement: raw[104], // ISA16 sub-element separator
    segment: raw[105], // Segment terminator follows ISA16
  };
}

// ---------------------------------------------------------------------------
// Segment Parsing
// ---------------------------------------------------------------------------

/**
 * Split raw EDI text into individual EDISegment objects.
 * Handles whitespace/newlines between segments gracefully.
 */
function splitSegments(raw: string, separators: EDISeparators): EDISegment[] {
  const { element, segment } = separators;

  // Split on segment terminator, filter empty strings (trailing terminators, whitespace)
  const rawSegments = raw
    .split(segment)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return rawSegments.map((seg) => {
    const elements = seg.split(element);
    const id = elements[0];
    return {
      id,
      elements: elements.slice(1),
    };
  });
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

/**
 * Parse raw EDI text into a structured EDIDocument.
 *
 * Extracts envelope segments (ISA/IEA, GS/GE) and groups the inner
 * segments into transaction sets (ST...SE pairs).
 *
 * @param raw - The raw EDI string
 * @returns A structured EDIDocument
 */
export function parseEDI(raw: string): EDIDocument {
  const separators = detectSeparators(raw);
  const allSegments = splitSegments(raw, separators);

  let isa: EDISegment | null = null;
  let iea: EDISegment | null = null;
  let gs: EDISegment | null = null;
  let ge: EDISegment | null = null;
  const transactionSets: EDITransactionSet[] = [];

  // Track current transaction set being built
  let currentTxSegments: EDISegment[] = [];
  let currentST: EDISegment | null = null;

  for (const segment of allSegments) {
    switch (segment.id) {
      // ISA — Interchange Control Header
      // Contains sender/receiver IDs, date/time, control number
      case "ISA":
        isa = segment;
        break;

      // IEA — Interchange Control Trailer
      // Contains count of functional groups and control number
      case "IEA":
        iea = segment;
        break;

      // GS — Functional Group Header
      // Contains functional identifier code, sender/receiver, date/time, control number
      case "GS":
        gs = segment;
        break;

      // GE — Functional Group Trailer
      // Contains count of transaction sets and group control number
      case "GE":
        ge = segment;
        break;

      // ST — Transaction Set Header
      // Contains transaction set identifier code (e.g. "940") and control number
      case "ST":
        currentST = segment;
        currentTxSegments = [segment];
        break;

      // SE — Transaction Set Trailer
      // Contains count of segments and control number
      case "SE":
        if (currentST) {
          currentTxSegments.push(segment);
          transactionSets.push({
            st: currentST,
            se: segment,
            type: currentST.elements[0] ?? "", // First element of ST = transaction type
            segments: currentTxSegments,
          });
          currentST = null;
          currentTxSegments = [];
        }
        break;

      // All other segments belong to the current transaction set
      default:
        if (currentST) {
          currentTxSegments.push(segment);
        }
        break;
    }
  }

  return {
    isa,
    iea,
    gs,
    ge,
    transactionSets,
    separators,
  };
}

// ---------------------------------------------------------------------------
// 940 Parser — Warehouse Shipping Order
// ---------------------------------------------------------------------------

/**
 * Parse segments from a 940 transaction set into a structured EDI940 object.
 *
 * Key 940 segments:
 *   W05 — Shipping Order Identification
 *   N1/N3/N4 — Name/Address (ship-to, ship-from, etc.)
 *   G62 — Date/Time
 *   W04 — Line Item Detail (one per item)
 *   NTE — Note/Special Instruction
 *   W20 — Item Detail (alternative format)
 */
export function parse940(segments: EDISegment[]): EDIParsingResult<EDI940> {
  const errors: string[] = [];

  // Find W05 — Shipping Order Identification
  const w05 = segments.find((s) => s.id === "W05");
  if (!w05) {
    errors.push("Missing W05 (Shipping Order Identification) segment");
    return { success: false, data: null, errors, document: null };
  }

  // W05*N*orderNumber*depositorOrderNumber*purchaseOrderNumber
  // W05 elements: [0]=order status type, [1]=order number, [2]=depositor order#, [3]=PO#
  const orderNumber = w05.elements[1] ?? "";
  const depositorOrderNumber = w05.elements[2] ?? "";
  const purchaseOrderNumber = w05.elements[3] || undefined;

  // Extract ship-to address from N1/N3/N4 loop where N1 qualifier is "ST" (Ship To)
  const shipToAddress = extractAddress(segments, "ST");
  const shipToName = extractN1Name(segments, "ST");

  // G62 — Date/Time reference. Qualifier "10" = requested ship date
  const g62 = segments.find(
    (s) => s.id === "G62" && s.elements[0] === "10"
  );
  const requestedShipDate = g62?.elements[1] || undefined;

  // TD5 — Carrier details
  // TD5*O*2*carrierCode**shippingMethod
  const td5 = segments.find((s) => s.id === "TD5");
  const carrierCode = td5?.elements[2] || undefined;
  const shippingMethod = td5?.elements[4] || undefined;

  // NTE — Notes
  const nteSegments = segments.filter((s) => s.id === "NTE");
  const notes = nteSegments.map((n) => n.elements[1] ?? "").join("; ") || undefined;

  const header: EDI940Header = {
    orderNumber,
    depositorOrderNumber,
    purchaseOrderNumber,
    shipToName: shipToName ?? "",
    shipToAddress: shipToAddress ?? { street1: "", city: "", state: "", zip: "" },
    requestedShipDate,
    carrierCode,
    shippingMethod,
    notes,
  };

  // W04 — Line Item Detail
  // W04*qty*uom*itemQualifier*itemNumber*lotNumber
  const lineItems: EDI940LineItem[] = [];
  let lineNumber = 0;

  for (const seg of segments) {
    if (seg.id !== "W04") continue;
    lineNumber++;

    const qty = parseFloat(seg.elements[0] ?? "0");
    const uom = seg.elements[1] ?? "EA";
    const qualifier = seg.elements[2] ?? "SK";
    const itemNum = seg.elements[3] ?? "";
    const lot = seg.elements[4] || undefined;

    lineItems.push({
      lineNumber,
      itemNumber: itemNum,
      itemQualifier: qualifier,
      quantityOrdered: qty,
      unitOfMeasure: uom,
      lotNumber: lot,
    });
  }

  if (lineItems.length === 0) {
    errors.push("No W04 (Line Item Detail) segments found");
  }

  return {
    success: errors.length === 0,
    data: { header, lineItems },
    errors,
    document: null,
  };
}

// ---------------------------------------------------------------------------
// 856 Parser — Advance Ship Notice
// ---------------------------------------------------------------------------

/**
 * Parse segments from an 856 transaction set into a structured EDI856 object.
 *
 * Key 856 segments:
 *   BSN — Beginning Segment for Ship Notice
 *   DTM — Date/Time Reference
 *   TD5 — Carrier Details
 *   TD1 — Carrier Details (quantity and weight)
 *   N1/N3/N4 — Name/Address loops
 *   HL — Hierarchical Level (shipment > order > pack > item)
 *   LIN — Item Identification
 *   SN1 — Item Detail (Shipment)
 *   MAN — Marks and Numbers (serial/carton identifiers)
 */
export function parse856(segments: EDISegment[]): EDIParsingResult<EDI856> {
  const errors: string[] = [];

  // BSN — Beginning Segment for Ship Notice
  // BSN*00*shipmentId*date*time
  const bsn = segments.find((s) => s.id === "BSN");
  if (!bsn) {
    errors.push("Missing BSN (Beginning Segment for Ship Notice) segment");
    return { success: false, data: null, errors, document: null };
  }

  const shipmentId = bsn.elements[1] ?? "";
  const shipDate = bsn.elements[2] ?? "";
  const shipTime = bsn.elements[3] || undefined;

  // TD5 — Carrier details
  const td5 = segments.find((s) => s.id === "TD5");
  const carrierCode = td5?.elements[2] || undefined;
  const carrierName = td5?.elements[4] || undefined;

  // REF — Reference numbers. Qualifier "BM" = Bill of Lading
  const bolRef = segments.find(
    (s) => s.id === "REF" && s.elements[0] === "BM"
  );
  const bolNumber = bolRef?.elements[1] || undefined;

  // DTM — Date/Time reference. Qualifier "017" = estimated delivery
  const dtm = segments.find(
    (s) => s.id === "DTM" && s.elements[0] === "017"
  );
  const estimatedDeliveryDate = dtm?.elements[1] || undefined;

  // Addresses
  const shipFromAddress = extractAddress(segments, "SF");
  const shipToAddress = extractAddress(segments, "ST");

  const header: EDI856Header = {
    shipmentId,
    shipDate,
    shipTime,
    bolNumber,
    carrierCode,
    carrierName,
    shipFromAddress: shipFromAddress ?? undefined,
    shipToAddress: shipToAddress ?? undefined,
    estimatedDeliveryDate,
  };

  // Extract items from LIN/SN1 loops
  const items: EDI856Item[] = [];
  let currentItem: Partial<EDI856Item> | null = null;

  for (const seg of segments) {
    if (seg.id === "LIN") {
      // LIN — Item Identification
      // LIN**qualifier*itemNumber
      if (currentItem?.itemNumber) {
        items.push(currentItem as EDI856Item);
      }
      currentItem = {
        itemNumber: seg.elements[2] ?? "",
        itemQualifier: seg.elements[1] ?? "SK",
        quantity: 0,
        unitOfMeasure: "EA",
      };
    } else if (seg.id === "SN1" && currentItem) {
      // SN1 — Item Detail (Shipment)
      // SN1**quantityShipped*uom
      currentItem.quantity = parseFloat(seg.elements[1] ?? "0");
      currentItem.unitOfMeasure = seg.elements[2] ?? "EA";
    } else if (seg.id === "PRF" && currentItem) {
      // PRF — Purchase Order Reference
      currentItem.purchaseOrderNumber = seg.elements[0] || undefined;
    } else if (seg.id === "PID" && currentItem) {
      // PID — Product/Item Description
      currentItem.description = seg.elements[4] || undefined;
    } else if (seg.id === "MAN" && currentItem) {
      // MAN — Marks and Numbers (serial numbers, carton IDs)
      if (!currentItem.serialNumbers) currentItem.serialNumbers = [];
      if (seg.elements[1]) {
        currentItem.serialNumbers.push(seg.elements[1]);
      }
    }
  }

  // Push the last item if present
  if (currentItem?.itemNumber) {
    items.push(currentItem as EDI856Item);
  }

  return {
    success: errors.length === 0,
    data: { header, items },
    errors,
    document: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers — N1/N3/N4 Address Extraction
// ---------------------------------------------------------------------------

/**
 * Extract an address from N1/N3/N4 segment loops.
 *
 * N1 — Name segment: N1*qualifier*name*idCodeQualifier*idCode
 * N3 — Address: N3*street1*street2
 * N4 — Geographic Location: N4*city*state*zip*country
 *
 * Segments are positional: after an N1 with the matching qualifier,
 * the next N3 and N4 segments provide the address.
 */
function extractAddress(
  segments: EDISegment[],
  qualifier: string
): EDIAddress | null {
  let found = false;
  let street1 = "";
  let street2: string | undefined;
  let city = "";
  let state = "";
  let zip = "";
  let country: string | undefined;

  for (const seg of segments) {
    if (seg.id === "N1" && seg.elements[0] === qualifier) {
      found = true;
      continue;
    }

    if (found) {
      if (seg.id === "N3") {
        street1 = seg.elements[0] ?? "";
        street2 = seg.elements[1] || undefined;
      } else if (seg.id === "N4") {
        city = seg.elements[0] ?? "";
        state = seg.elements[1] ?? "";
        zip = seg.elements[2] ?? "";
        country = seg.elements[3] || undefined;
        // We have all address parts, stop looking
        break;
      } else if (seg.id === "N1") {
        // Hit another N1, stop — we passed the address block
        break;
      }
    }
  }

  if (!found) return null;

  return { street1, street2, city, state, zip, country };
}

/** Extract the name from an N1 segment matching the given qualifier. */
function extractN1Name(
  segments: EDISegment[],
  qualifier: string
): string | null {
  const n1 = segments.find(
    (s) => s.id === "N1" && s.elements[0] === qualifier
  );
  return n1?.elements[1] ?? null;
}
