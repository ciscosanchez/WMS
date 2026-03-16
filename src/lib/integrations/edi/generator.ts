/**
 * EDI Generator
 *
 * Generates outbound EDI documents from structured data. Wraps transaction
 * set content in the standard ISA/GS/ST...SE/GE/IEA envelope.
 *
 * Supports:
 *   - EDI 945: Warehouse Shipping Advice (confirmation that an order shipped)
 *   - EDI 944: Warehouse Stock Transfer Receipt (confirmation of receiving)
 */

import type { EDI945Data, EDI944Data } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ELEMENT_SEP = "*";
const SEGMENT_TERM = "~";

// ---------------------------------------------------------------------------
// Envelope Helpers
// ---------------------------------------------------------------------------

/**
 * Build the ISA (Interchange Control Header) segment.
 *
 * ISA is a fixed-width segment with 16 elements. Certain fields are
 * right-padded to their required lengths per the X12 specification.
 *
 * ISA*00*          *00*          *ZZ*senderId       *ZZ*receiverId     *date*time*U*00401*controlNum*0*P*:~
 */
function buildISA(senderId: string, receiverId: string, controlNumber: string): string {
  const now = new Date();
  const date = formatDate6(now); // YYMMDD
  const time = formatTime4(now); // HHMM

  const elements = [
    "ISA",
    "00", // Authorization Information Qualifier
    pad("", 10), // Authorization Information (blank)
    "00", // Security Information Qualifier
    pad("", 10), // Security Information (blank)
    "ZZ", // Interchange ID Qualifier (mutually defined)
    pad(senderId, 15), // Interchange Sender ID
    "ZZ", // Interchange ID Qualifier
    pad(receiverId, 15), // Interchange Receiver ID
    date, // Interchange Date
    time, // Interchange Time
    "U", // Repetition Separator (standard)
    "00401", // Interchange Control Version Number
    padNum(controlNumber, 9), // Interchange Control Number
    "0", // Acknowledgment Requested
    "P", // Usage Indicator (P = Production, T = Test)
    ":", // Component Element Separator
  ];

  return elements.join(ELEMENT_SEP) + SEGMENT_TERM;
}

/** Build IEA (Interchange Control Trailer). */
function buildIEA(groupCount: number, controlNumber: string): string {
  return seg("IEA", String(groupCount), padNum(controlNumber, 9));
}

/**
 * Build GS (Functional Group Header).
 *
 * GS*functionalId*senderCode*receiverCode*date*time*groupControlNum*X*004010~
 */
function buildGS(
  functionalId: string,
  senderId: string,
  receiverId: string,
  groupControlNumber: string
): string {
  const now = new Date();
  return seg(
    "GS",
    functionalId, // Functional Identifier Code: "SW" = shipping, "RE" = receiving
    senderId,
    receiverId,
    formatDate8(now), // CCYYMMDD
    formatTime4(now), // HHMM
    groupControlNumber,
    "X", // Responsible Agency Code
    "004010" // Version / Release / Industry Identifier Code
  );
}

/** Build GE (Functional Group Trailer). */
function buildGE(txSetCount: number, groupControlNumber: string): string {
  return seg("GE", String(txSetCount), groupControlNumber);
}

/** Build ST (Transaction Set Header). */
function buildST(txSetId: string, controlNumber: string): string {
  return seg("ST", txSetId, padNum(controlNumber, 4));
}

/** Build SE (Transaction Set Trailer). */
function buildSE(segmentCount: number, controlNumber: string): string {
  return seg("SE", String(segmentCount), padNum(controlNumber, 4));
}

// ---------------------------------------------------------------------------
// EDI 945 Generator — Warehouse Shipping Advice
// ---------------------------------------------------------------------------

/**
 * Generate an EDI 945 (Warehouse Shipping Advice) from structured data.
 *
 * The 945 confirms to the customer that their 940 order has been shipped.
 * It includes what was shipped, tracking info, and carrier details.
 */
export function generate945(data: EDI945Data): string {
  const lines: string[] = [];

  // ISA envelope
  lines.push(buildISA(data.senderId, data.receiverId, data.controlNumber));

  // GS — Functional Group Header (SW = Warehouse Shipping Advice)
  lines.push(buildGS("SW", data.senderId, data.receiverId, data.groupControlNumber));

  // Build the transaction set content (between ST and SE)
  const txLines: string[] = [];

  // ST — Transaction Set Header
  txLines.push(buildST("945", data.transactionControlNumber));

  // W06 — Warehouse Shipment Identification
  // W06*shipmentId*depositorOrderNumber*orderNumber*shipDate*warehouseCode
  txLines.push(
    seg(
      "W06",
      data.header.shipmentId,
      data.header.depositorOrderNumber,
      data.header.orderNumber,
      data.header.shipDate
    )
  );

  // N1 — Ship-to name (if provided)
  if (data.header.shipToAddress) {
    txLines.push(seg("N1", "ST", data.header.shipToAddress.name ?? "Ship To"));
    txLines.push(
      seg("N3", data.header.shipToAddress.street1, data.header.shipToAddress.street2 ?? "")
    );
    txLines.push(
      seg(
        "N4",
        data.header.shipToAddress.city,
        data.header.shipToAddress.state,
        data.header.shipToAddress.zip,
        data.header.shipToAddress.country ?? "US"
      )
    );
  }

  // N9 — Reference: tracking number
  if (data.header.trackingNumber) {
    txLines.push(seg("N9", "CN", data.header.trackingNumber)); // CN = Carrier's Reference Number
  }

  // N9 — Reference: BOL number
  if (data.header.bolNumber) {
    txLines.push(seg("N9", "BM", data.header.bolNumber)); // BM = Bill of Lading
  }

  // W12 — Line item detail for each shipped item
  for (const item of data.lineItems) {
    // W12*shipmentQty*uom*weight**itemQualifier*itemNumber*lotNumber*description
    txLines.push(
      seg(
        "W12",
        String(item.quantityShipped),
        item.unitOfMeasure,
        "", // weight placeholder
        "", // weight qualifier placeholder
        item.itemQualifier,
        item.itemNumber,
        item.lotNumber ?? "",
        item.description ?? ""
      )
    );
  }

  // W03 — Total shipment info
  if (data.header.totalWeight || data.header.totalPackages) {
    txLines.push(
      seg(
        "W03",
        String(data.header.totalPackages ?? 0),
        String(data.header.totalWeight ?? 0),
        "LB" // weight unit
      )
    );
  }

  // SE — segment count includes ST and SE themselves
  const segmentCount = txLines.length + 1; // +1 for SE itself
  txLines.push(buildSE(segmentCount, data.transactionControlNumber));

  lines.push(...txLines);

  // GE — Functional Group Trailer (1 transaction set in this group)
  lines.push(buildGE(1, data.groupControlNumber));

  // IEA — Interchange Control Trailer (1 functional group)
  lines.push(buildIEA(1, data.controlNumber));

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// EDI 944 Generator — Warehouse Stock Transfer Receipt
// ---------------------------------------------------------------------------

/**
 * Generate an EDI 944 (Warehouse Stock Transfer Receipt) from structured data.
 *
 * The 944 confirms to the customer that inbound goods have been received
 * at the warehouse, including quantities and any damage notes.
 */
export function generate944(data: EDI944Data): string {
  const lines: string[] = [];

  // ISA envelope
  lines.push(buildISA(data.senderId, data.receiverId, data.controlNumber));

  // GS — Functional Group Header (RE = Warehouse Stock Transfer Receipt Advice)
  lines.push(buildGS("RE", data.senderId, data.receiverId, data.groupControlNumber));

  // Build the transaction set content
  const txLines: string[] = [];

  // ST — Transaction Set Header
  txLines.push(buildST("944", data.transactionControlNumber));

  // W17 — Warehouse Receipt Identification
  // W17*receiptStatusType*receiptDate*receiptId*warehouseCode*depositorCode
  txLines.push(
    seg(
      "W17",
      "N", // N = New (receipt status)
      data.header.receiptDate,
      data.header.receiptId,
      data.header.warehouseCode ?? "",
      data.header.depositorCode ?? ""
    )
  );

  // N9 — Reference: original shipment ID
  if (data.header.shipmentId) {
    txLines.push(seg("N9", "SI", data.header.shipmentId)); // SI = Shipper's Identifying Number
  }

  // NTE — Note
  if (data.header.notes) {
    txLines.push(seg("NTE", "GEN", data.header.notes)); // GEN = General note
  }

  // W07 — Line item detail for each received item
  for (const item of data.lineItems) {
    // W07*qty*uom*itemQualifier*itemNumber*lotNumber
    txLines.push(
      seg(
        "W07",
        String(item.quantityReceived),
        item.unitOfMeasure,
        item.itemQualifier,
        item.itemNumber,
        item.lotNumber ?? ""
      )
    );

    // N9 — Damage info if applicable
    if (item.damaged === "Y" && item.quantityDamaged) {
      txLines.push(seg("N9", "DM", String(item.quantityDamaged))); // DM = Damaged
    }
  }

  // SE — Transaction Set Trailer
  const segmentCount = txLines.length + 1;
  txLines.push(buildSE(segmentCount, data.transactionControlNumber));

  lines.push(...txLines);

  // GE / IEA
  lines.push(buildGE(1, data.groupControlNumber));
  lines.push(buildIEA(1, data.controlNumber));

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Formatting Utilities
// ---------------------------------------------------------------------------

/** Create a segment string from an ID and elements. */
function seg(id: string, ...elements: string[]): string {
  return [id, ...elements].join(ELEMENT_SEP) + SEGMENT_TERM;
}

/** Right-pad a string with spaces to a given length. */
function pad(value: string, length: number): string {
  return value.padEnd(length, " ");
}

/** Left-pad a numeric string with zeros to a given length. */
function padNum(value: string, length: number): string {
  return value.padStart(length, "0");
}

/** Format date as YYMMDD. */
function formatDate6(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Format date as CCYYMMDD. */
function formatDate8(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/** Format time as HHMM. */
function formatTime4(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}${mm}`;
}
