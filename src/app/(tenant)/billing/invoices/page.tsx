import React from "react";
import { getTranslations } from "next-intl/server";
import { getInvoices } from "@/modules/billing/actions";
import {
  approveInvoice,
  rejectInvoice,
  markInvoiceSent,
  markInvoicePaid,
} from "@/modules/billing/invoice-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  overdue: "destructive",
  cancelled: "destructive",
};

const reviewVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  review_pending: "secondary",
  review_approved: "default",
  review_rejected: "destructive",
};

export default async function InvoicesPage() {
  const t = await getTranslations("tenant.billing");
  const invoices = await getInvoices().catch(() => []);

  async function handleApprove(formData: FormData) {
    "use server";
    await approveInvoice(formData.get("invoiceId") as string);
  }

  async function handleReject(formData: FormData) {
    "use server";
    await rejectInvoice(formData.get("invoiceId") as string, formData.get("notes") as string);
  }

  async function handleSend(formData: FormData) {
    "use server";
    await markInvoiceSent(formData.get("invoiceId") as string, "email");
  }

  async function handlePaid(formData: FormData) {
    "use server";
    await markInvoicePaid(formData.get("invoiceId") as string);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("invoices")} description={t("invoicesSubtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("invoicesList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState icon={FileText} title={t("noInvoices")} description={t("noInvoicesDesc")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("invoiceNumber")}</th>
                    <th className="pb-2 font-medium">{t("client")}</th>
                    <th className="pb-2 font-medium">{t("status")}</th>
                    <th className="pb-2 font-medium">{t("reviewStatus")}</th>
                    <th className="pb-2 font-medium">{t("period")}</th>
                    <th className="pb-2 font-medium">{t("total")}</th>
                    <th className="pb-2 font-medium">{t("sentDate")}</th>
                    <th className="pb-2 font-medium">{t("paidDate")}</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2">{inv.client?.name ?? "-"}</td>
                      <td className="py-2">
                        <Badge variant={statusVariant[inv.status] ?? "secondary"}>
                          {t(`status_${inv.status}`)}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {inv.reviewStatus && (
                          <Badge variant={reviewVariant[inv.reviewStatus] ?? "secondary"}>
                            {t(`review_${inv.reviewStatus}`)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {inv.periodStart
                          ? `${new Date(inv.periodStart).toLocaleDateString()} - ${new Date(inv.periodEnd).toLocaleDateString()}`
                          : "-"}
                      </td>
                      <td className="py-2 font-mono">${Number(inv.total).toFixed(2)}</td>
                      <td className="py-2 text-muted-foreground">
                        {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-2">
                        <InvoiceActions
                          invoice={inv}
                          t={t}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onSend={handleSend}
                          onPaid={handlePaid}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceActions({
  invoice,
  t,
  onApprove,
  onReject,
  onSend,
  onPaid,
}: {
  invoice: any;
  t: any;
  onApprove: (fd: FormData) => Promise<void>;
  onReject: (fd: FormData) => Promise<void>;
  onSend: (fd: FormData) => Promise<void>;
  onPaid: (fd: FormData) => Promise<void>;
}) {
  const actions: React.ReactElement[] = [];

  if (invoice.status === "draft" && invoice.reviewStatus === "review_pending") {
    actions.push(
      <form key="approve" action={onApprove} className="inline">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <button
          type="submit"
          className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
        >
          {t("approve")}
        </button>
      </form>,
      <form key="reject" action={onReject} className="inline ml-1">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <input type="hidden" name="notes" value="Rejected" />
        <button
          type="submit"
          className="inline-flex h-7 items-center rounded-md border border-destructive px-2 text-xs text-destructive hover:bg-destructive/10"
        >
          {t("reject")}
        </button>
      </form>
    );
  }

  if (invoice.status === "draft" && invoice.reviewStatus === "review_approved") {
    actions.push(
      <form key="send" action={onSend} className="inline">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <button
          type="submit"
          className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
        >
          {t("send")}
        </button>
      </form>
    );
  }

  if (invoice.status === "sent" || invoice.status === "overdue") {
    actions.push(
      <form key="paid" action={onPaid} className="inline">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <button
          type="submit"
          className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
        >
          {t("markPaid")}
        </button>
      </form>
    );
  }

  if (actions.length === 0) return null;

  return <div className="flex gap-1">{actions}</div>;
}
