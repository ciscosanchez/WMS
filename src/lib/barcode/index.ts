// Barcode generation utility
// JsBarcode is a client-side library; this module provides helpers for generating barcode data

export function generateBinBarcode(
  warehouseCode: string,
  zoneCode: string,
  aisleCode: string,
  rackCode: string,
  shelfCode: string,
  binCode: string
): string {
  return `${warehouseCode}-${zoneCode}-${aisleCode}-${rackCode}-${shelfCode}-${binCode}`;
}

export function generateProductBarcode(sku: string): string {
  return sku;
}
