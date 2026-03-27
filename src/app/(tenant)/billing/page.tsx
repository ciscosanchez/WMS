import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getBillingDashboard, getUnbilledEvents } from "@/modules/billing/charge-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { DollarSign, Clock, AlertTriangle, CalendarClock, ArrowRight, Receipt } from "lucide-react";

const fallbackDashboard = {
  unbilledCount: 0,
  unbilledAmount: 0,
  pendingReview: 0,
  openDisputes: 0,
  overdueAmount: 0,
};

type UnbilledEvent = Awaited<ReturnType<typeof getUnbilledEvents>>[number];

export default async function BillingDashboardPage() {
  const t = await getTranslations("tenant.billing");

  const [dashboard, recentEvents] = await Promise.all([
    getBillingDashboard().catch(() => fallbackDashboard),
    getUnbilledEvents().catch(() => []),
  ]);

  const recent = recentEvents.slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("unbilledCharges")}
          value={`$${dashboard.unbilledAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description={`${dashboard.unbilledCount} ${t("charges").toLowerCase()}`}
          icon={DollarSign}
        />
        <KpiCard
          title={t("pendingReview")}
          value={dashboard.pendingReview}
          description={t("pendingReviewDesc")}
          icon={Clock}
        />
        <KpiCard
          title={t("openDisputes")}
          value={dashboard.openDisputes}
          description={t("openDisputesDesc")}
          icon={AlertTriangle}
        />
        <KpiCard
          title={t("overdueInvoices")}
          value={`$${dashboard.overdueAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          description={t("overdueDesc")}
          icon={CalendarClock}
        />
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink href="/billing/charges" label={t("charges")} />
        <QuickLink href="/billing/invoices" label={t("invoices")} />
        <QuickLink href="/billing/disputes" label={t("disputes")} />
      </div>

      {/* Recent Unbilled Events */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentUnbilled")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title={t("noCharges")} description={t("noChargesDesc")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("client")}</th>
                    <th className="pb-2 font-medium">{t("serviceType")}</th>
                    <th className="pb-2 font-medium">{t("quantity")}</th>
                    <th className="pb-2 font-medium">{t("amount")}</th>
                    <th className="pb-2 font-medium">{t("date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((event: UnbilledEvent) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="py-2">{event.client?.name ?? event.clientId?.slice(0, 8)}</td>
                      <td className="py-2">{event.serviceType}</td>
                      <td className="py-2">{Number(event.qty)}</td>
                      <td className="py-2 font-mono">${Number(event.amount).toFixed(2)}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleDateString()}
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

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted"
    >
      <span className="font-medium">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
