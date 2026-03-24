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
import { getTranslations } from "next-intl/server";

const statusMap: Record<string, string> = {
  paid: "completed",
  sent: "pending",
  draft: "pending",
  overdue: "failed",
  cancelled: "failed",
};

export default async function PortalBillingPage() {
  const t = await getTranslations("portal.billing");
  const data = await getPortalBillingData();

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <p className="text-sm text-muted-foreground">{t("noBillingData")}</p>
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
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title={t("outstandingBalance")}
          value={`$${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description={t("outstandingBalanceDesc")}
          icon={DollarSign}
        />
        <KpiCard
          title={t("lastInvoice")}
          value={lastInvoice ? `$${Number(lastInvoice.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
          description={lastInvoice?.invoiceNumber ?? t("noInvoices")}
          icon={FileText}
        />
        <KpiCard
          title={t("storageMtd")}
          value={`$${storageMTD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description={t("storageMtdDesc")}
          icon={Warehouse}
        />
        <KpiCard
          title={t("handlingMtd")}
          value={`$${handlingMTD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description={t("handlingMtdDesc")}
          icon={PackageCheck}
        />
      </div>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("noInvoicesGenerated")}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
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
                      {t("pdf")}
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
