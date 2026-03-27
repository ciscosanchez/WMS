import { NextRequest } from "next/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";
import { format } from "date-fns";

const COLUMNS: ExportColumn[] = [
  { key: "invoiceNumber", header: "Invoice #" },
  { key: "client", header: "Client" },
  { key: "status", header: "Status" },
  {
    key: "periodStart",
    header: "Period Start",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
  {
    key: "periodEnd",
    header: "Period End",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
  { key: "subtotal", header: "Subtotal" },
  { key: "total", header: "Total" },
  {
    key: "dueDate",
    header: "Due Date",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
  {
    key: "paidAt",
    header: "Paid Date",
    format: (v) => (v ? format(new Date(v as string), "yyyy-MM-dd") : ""),
  },
];

export async function GET(_request: NextRequest) {
  let tenant;
  let portalClientId: string | null | undefined;
  try {
    ({ tenant, portalClientId } = await requireTenantContext("billing:read"));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const invoices = await db.invoice.findMany({
    where: portalClientId ? { clientId: portalClientId } : undefined,
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const rows = invoices.map(
    (inv: {
      invoiceNumber: string;
      client: { name: string };
      status: string;
      periodStart: Date;
      periodEnd: Date;
      subtotal: unknown;
      total: unknown;
      dueDate: Date | null;
      paidAt: Date | null;
    }) => ({
      invoiceNumber: inv.invoiceNumber,
      client: inv.client.name,
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      subtotal: Number(inv.subtotal),
      total: Number(inv.total),
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
    })
  );

  const csv = generateCsv(rows, COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `billing-export-${date}.csv`);
}
