import { getLaborDashboard } from "@/modules/labor/queries";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { BarChartCard, PieChartCard } from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { HardHat, Users, Activity, DollarSign, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function LaborDashboardPage() {
  const t = await getTranslations("tenant.labor");
  const data = await getLaborDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title={t("activeOperators")}
          value={data.activeOperators}
          description={t("activeOperatorsDesc")}
          icon={Users}
        />
        <KpiCard
          title={t("avgUph")}
          value={data.avgUph}
          description={t("avgUphDesc")}
          icon={Activity}
        />
        <KpiCard
          title={t("avgTph")}
          value={data.avgTph}
          description={t("avgTphDesc")}
          icon={TrendingUp}
        />
        <KpiCard
          title={t("laborCostMtd")}
          value={`$${data.laborCostMtd.toLocaleString()}`}
          description={t("laborCostMtdDesc")}
          icon={DollarSign}
        />
        <KpiCard
          title={t("costPerUnit")}
          value={`$${data.costPerUnit}`}
          description={t("costPerUnitDesc")}
          icon={DollarSign}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard
          title={t("productivityByOperator")}
          data={data.productivityByOperator.map((op) => ({
            name: op.name,
            value: op.uph,
          }))}
        />
        <PieChartCard title={t("taskDistribution")} data={data.taskDistribution} />
      </div>

      {/* Operator Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>{t("leaderboard")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leaderboard.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title={t("noLeaderboardTitle")}
              description={t("noLeaderboardDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("operatorId")}</th>
                    <th className="pb-2 font-medium">{t("tasks")}</th>
                    <th className="pb-2 font-medium">{t("units")}</th>
                    <th className="pb-2 font-medium">{t("uph")}</th>
                    <th className="pb-2 font-medium">{t("hours")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((op) => (
                    <tr key={op.operatorId} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{op.operatorId.slice(0, 8)}...</td>
                      <td className="py-2">{op.tasks}</td>
                      <td className="py-2">{op.units}</td>
                      <td className="py-2 font-semibold">{op.uph}</td>
                      <td className="py-2">{op.hours}h</td>
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
