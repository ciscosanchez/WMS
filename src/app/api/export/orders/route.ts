import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveTenant } from "@/lib/tenant/context";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";
import { format } from "date-fns";

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
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const tenant = await resolveTenant();
  if (!tenant) return new Response("Tenant not found", { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const orders = await db.order.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const rows = orders.map(
    (o: {
      orderNumber: string;
      client: { name: string };
      status: string;
      shipToName: string;
      shipToCity: string;
      shipToState: string | null;
      totalItems: number;
      orderDate: Date;
      shippedDate: Date | null;
    }) => ({
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

  const csv = generateCsv(rows, COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `orders-export-${date}.csv`);
}
