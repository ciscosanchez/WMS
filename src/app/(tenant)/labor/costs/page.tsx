import { getLaborCostReport } from "@/modules/labor/queries";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { DollarSign, Clock, Package, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

interface CostPageProps {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    clientId?: string;
  }>;
}

export default async function LaborCostReportPage({ searchParams }: CostPageProps) {
  const t = await getTranslations("tenant.labor");
  const params = await searchParams;

  const now = new Date();
  const dateFrom =
    params.dateFrom ?? format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const dateTo = params.dateTo ?? format(now, "yyyy-MM-dd");

  const report = await getLaborCostReport(dateFrom, dateTo, params.clientId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("costReportTitle")}
        description={t("costReportSubtitle", { from: dateFrom, to: dateTo })}
      />

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("totalHours")}
          value={`${report.totalHours}h`}
          description={t("totalHoursDesc")}
          icon={Clock}
        />
        <KpiCard
          title={t("totalCost")}
          value={`$${report.totalCost.toLocaleString()}`}
          description={t("totalCostDesc")}
          icon={DollarSign}
        />
        <KpiCard
          title={t("totalUnits")}
          value={report.totalUnits.toLocaleString()}
          description={t("totalUnitsDesc")}
          icon={Package}
        />
        <KpiCard
          title={t("costPerUnit")}
          value={`$${report.costPerUnit}`}
          description={t("costPerUnitDesc")}
          icon={TrendingDown}
        />
      </div>

      {/* By Client Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("costByClient")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.byClient.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={t("noCostDataTitle")}
              description={t("noCostDataDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("clientId")}</th>
                    <th className="pb-2 font-medium">{t("allocatedHours")}</th>
                    <th className="pb-2 font-medium">{t("units")}</th>
                    <th className="pb-2 font-medium">{t("allocatedCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byClient.map(
                    (row: {
                      clientId: string;
                      clientLabel: string;
                      hours: number;
                      units: number;
                      cost: number;
                    }) => (
                      <tr key={row.clientId} className="border-b last:border-0">
                        <td className="py-2">{row.clientLabel}</td>
                        <td className="py-2">{row.hours}h</td>
                        <td className="py-2">{row.units}</td>
                        <td className="py-2 font-semibold">${row.cost.toLocaleString()}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
