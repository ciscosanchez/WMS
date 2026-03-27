import { NextRequest } from "next/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";
import {
  attachOperationalAttributesToEntityRows,
  buildOperationalAttributeExportColumns,
} from "@/modules/attributes/export";

const COLUMNS: ExportColumn[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Product Name" },
  { key: "binBarcode", header: "Bin" },
  { key: "lotNumber", header: "Lot #" },
  { key: "onHand", header: "On Hand" },
  { key: "allocated", header: "Allocated" },
  { key: "available", header: "Available" },
];

export async function GET(_request: NextRequest) {
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

  const attributeDefinitions = (await db.operationalAttributeDefinition.findMany({
    where: {
      entityScope: "inventory_record",
      isActive: true,
    },
    select: { id: true, key: true, label: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  })) as Array<{ id: string; key: string; label: string; sortOrder: number }>;

  const attributeValues =
    inventory.length > 0
      ? ((await db.operationalAttributeValue.findMany({
          where: {
            entityScope: "inventory_record",
            entityId: { in: inventory.map((inv: { id: string }) => inv.id) },
            definitionId: { in: attributeDefinitions.map((definition) => definition.id) },
          },
          select: {
            entityId: true,
            definitionId: true,
            textValue: true,
            numberValue: true,
            booleanValue: true,
            dateValue: true,
            jsonValue: true,
          },
        })) as Array<{
          entityId: string;
          definitionId: string;
          textValue?: string | null;
          numberValue?: number | null;
          booleanValue?: boolean | null;
          dateValue?: Date | null;
          jsonValue?: unknown;
        }>)
      : [];

  const baseRows = inventory.map(
    (inv: {
      id: string;
      product: { sku: string; name: string };
      bin: { barcode: string };
      lotNumber: string | null;
      onHand: number;
      allocated: number;
      available: number;
    }) => ({
      id: inv.id,
      sku: inv.product.sku,
      name: inv.product.name,
      binBarcode: inv.bin.barcode,
      lotNumber: inv.lotNumber ?? "",
      onHand: inv.onHand,
      allocated: inv.allocated,
      available: inv.available,
    })
  );

  const rows = attachOperationalAttributesToEntityRows({
    rows: baseRows,
    definitions: attributeDefinitions,
    values: attributeValues,
  }).map(({ id: _id, ...row }) => row);

  const csv = generateCsv(rows, [
    ...COLUMNS,
    ...buildOperationalAttributeExportColumns(attributeDefinitions),
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `inventory-export-${date}.csv`);
}
