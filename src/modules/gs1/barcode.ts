/**
 * GS1-128 Barcode Data Formatter
 *
 * Formats data into GS1-128 Application Identifier (AI) strings.
 * Common AIs: (00) SSCC, (01) GTIN-14, (10) Batch/Lot, (17) Expiry YYMMDD,
 * (21) Serial, (37) Count, (400) PO number
 */

export interface GS1BarcodeData {
  sscc?: string;
  gtin?: string;
  lotNumber?: string;
  expirationDate?: Date;
  itemCount?: number;
  purchaseOrder?: string;
  serialNumber?: string;
  weight?: { kg: number };
}

function formatGS1Date(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Generate a GS1-128 barcode data string from structured data */
export function generateGS1Barcode(data: GS1BarcodeData): string {
  const parts: string[] = [];

  if (data.sscc) parts.push(`(00)${data.sscc}`);
  if (data.gtin) parts.push(`(01)${data.gtin.padStart(14, "0")}`);
  if (data.lotNumber) parts.push(`(10)${data.lotNumber}`);
  if (data.expirationDate) parts.push(`(17)${formatGS1Date(data.expirationDate)}`);
  if (data.serialNumber) parts.push(`(21)${data.serialNumber}`);
  if (data.itemCount !== undefined) parts.push(`(37)${data.itemCount}`);
  if (data.weight?.kg !== undefined) {
    const weightStr = Math.round(data.weight.kg * 1000000)
      .toString()
      .padStart(6, "0");
    parts.push(`(3106)${weightStr}`);
  }
  if (data.purchaseOrder) parts.push(`(400)${data.purchaseOrder}`);

  return parts.join("");
}

/** Parse a GS1-128 barcode string back into structured data */
export function parseGS1Barcode(barcode: string): GS1BarcodeData {
  const result: GS1BarcodeData = {};
  const aiPattern = /\((\d{2,4})\)([^(]*)/g;
  let match: RegExpExecArray | null;

  while ((match = aiPattern.exec(barcode)) !== null) {
    const [, ai, value] = match;
    switch (ai) {
      case "00":
        result.sscc = value;
        break;
      case "01":
        result.gtin = value;
        break;
      case "10":
        result.lotNumber = value;
        break;
      case "17": {
        const yy = parseInt(value.slice(0, 2), 10);
        const mm = parseInt(value.slice(2, 4), 10) - 1;
        const dd = parseInt(value.slice(4, 6), 10);
        const year = yy >= 50 ? 1900 + yy : 2000 + yy;
        result.expirationDate = new Date(year, mm, dd);
        break;
      }
      case "21":
        result.serialNumber = value;
        break;
      case "37":
        result.itemCount = parseInt(value, 10);
        break;
      case "400":
        result.purchaseOrder = value;
        break;
    }
  }

  return result;
}
