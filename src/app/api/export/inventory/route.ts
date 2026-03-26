import { NextRequest } from "next/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";

const COLUMNS: ExportColumn[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Product Name" },
  { key: "binBarcode", header: "Bin" },
  { key: "lotNumber", header: "Lot #" },
  { key: "onHand", header: "On Hand" },
  { key: "allocated", header: "Allocated" },
  { key: "available", header: "Available" },
];

export async function GET(request: NextRequest) {
  let tenant;
  let portalClientId: string | null | undefined;
  try {
    ({ tenant, portalClientId } = await requireTenantContext("inventory:read"));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const inventory = await db.inventory.findMany({
    where: {
      onHand: { gt: 0 },
      ...(portalClientId ? { product: { clientId: portalClientId } } : {}),
    },
    include: {
      product: { select: { sku: true, name: true } },
      bin: { select: { barcode: true } },
    },
    orderBy: { product: { sku: "asc" } },
  });

  const rows = inventory.map(
    (inv: {
      product: { sku: string; name: string };
      bin: { barcode: string };
      lotNumber: string | null;
      onHand: number;
      allocated: number;
      available: number;
    }) => ({
      sku: inv.product.sku,
      name: inv.product.name,
      binBarcode: inv.bin.barcode,
      lotNumber: inv.lotNumber ?? "",
      onHand: inv.onHand,
      allocated: inv.allocated,
      available: inv.available,
    })
  );

  const csv = generateCsv(rows, COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `inventory-export-${date}.csv`);
}
