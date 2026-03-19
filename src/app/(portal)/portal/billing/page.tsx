import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText, Warehouse, PackageCheck, Download } from "lucide-react";
import { format } from "date-fns";
import { getPortalBillingData } from "@/modules/billing/actions";

const statusMap: Record<string, string> = {
  paid: "completed",
  sent: "pending",
  draft: "pending",
  overdue: "failed",
  cancelled: "failed",
};

export default async function PortalBillingPage() {
  const data = await getPortalBillingData();

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Invoices and charges for your account" />
        <p className="text-sm text-muted-foreground">No billing data available.</p>
      </div>
    );
  }

  const { invoices, mtdSummary, outstanding } = data;

  // MTD KPIs
  const storageMTD = mtdSummary.find((s) => s.name.includes("Storage"))?.value ?? 0;
  const handlingMTD = mtdSummary.reduce(
    (sum, s) => (s.name.includes("Handling") ? sum + s.value : sum),
    0
  );
  const lastInvoice = invoices[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Invoices and charges for your account" />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Outstanding Balance"
          value={`$${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description="Unpaid invoices"
          icon={DollarSign}
        />
        <KpiCard
          title="Last Invoice"
          value={lastInvoice ? `$${Number(lastInvoice.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
          description={lastInvoice?.invoiceNumber ?? "No invoices yet"}
          icon={FileText}
        />
        <KpiCard
          title="Storage Charges (MTD)"
          value={`$${storageMTD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description="Current month storage"
          icon={Warehouse}
        />
        <KpiCard
          title="Handling Charges (MTD)"
          value={`$${handlingMTD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description="Current month handling"
          icon={PackageCheck}
        />
      </div>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No invoices generated yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    {format(new Date(invoice.periodStart), "MMM d")}–{format(new Date(invoice.periodEnd), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${Number(invoice.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={statusMap[invoice.status] ?? invoice.status} />
                  </TableCell>
                  <TableCell>
                    {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Download className="mr-1 h-4 w-4" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
