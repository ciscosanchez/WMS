import { NextRequest } from "next/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";
import { format } from "date-fns";
import {
  attachAggregatedOperationalAttributesToRows,
  buildOperationalAttributeExportColumns,
} from "@/modules/attributes/export";

const COLUMNS: ExportColumn[] = [
  { key: "orderNumber", header: "Order #" },
  { key: "client", header: "Client" },
  { key: "status", header: "Status" },
  { key: "shipToName", header: "Ship To" },
  { key: "shipToCity", header: "City" },
  { key: "shipToState", header: "State" },
  { key: "totalItems", header: "Items" },
  {
    key: "orderDate",
    header: "Order Date",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
  {
    key: "shippedDate",
    header: "Shipped Date",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
];

export async function GET(request: NextRequest) {
  let tenant;
  let portalClientId: string | null | undefined;
  try {
    ({ tenant, portalClientId } = await requireTenantContext("orders:read"));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const orders = await db.order.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: {
      ...(status ? { status: status as any } : {}),
      ...(portalClientId ? { clientId: portalClientId } : {}),
    },
    include: {
      client: { select: { name: true } },
      lines: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const attributeDefinitions = (await db.operationalAttributeDefinition.findMany({
    where: {
      entityScope: "order_line",
      isActive: true,
    },
    select: { id: true, key: true, label: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  })) as Array<{ id: string; key: string; label: string; sortOrder: number }>;

  const lineIds = orders.flatMap((o: { lines: Array<{ id: string }> }) => o.lines.map((line) => line.id));
  const entityToRowId = orders.reduce(
    (acc: Record<string, string>, order: { id: string; lines: Array<{ id: string }> }) => {
      for (const line of order.lines) acc[line.id] = order.id;
      return acc;
    },
    {} as Record<string, string>
  );

  const attributeValues =
    lineIds.length > 0
      ? ((await db.operationalAttributeValue.findMany({
          where: {
            entityScope: "order_line",
            entityId: { in: lineIds },
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

  const baseRows = orders.map(
    (o: {
      id: string;
      orderNumber: string;
      client: { name: string };
      status: string;
      shipToName: string;
      shipToCity: string;
      shipToState: string | null;
      totalItems: number;
      orderDate: Date;
      shippedDate: Date | null;
      lines: Array<{ id: string }>;
    }) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.client.name,
      status: o.status,
      shipToName: o.shipToName,
      shipToCity: o.shipToCity,
      shipToState: o.shipToState ?? "",
      totalItems: o.totalItems,
      orderDate: o.orderDate,
      shippedDate: o.shippedDate,
    })
  );

  const rows = attachAggregatedOperationalAttributesToRows({
    rows: baseRows,
    definitions: attributeDefinitions,
    values: attributeValues,
    entityToRowId,
  }).map(({ id: _id, ...row }) => row);

  const csv = generateCsv(rows, [...COLUMNS, ...buildOperationalAttributeExportColumns(attributeDefinitions)]);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `orders-export-${date}.csv`);
}
