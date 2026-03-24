import { getTranslations } from "next-intl/server";
import {
  getThroughputTrend,
  getSlaCompliance,
  getExceptionHeatmap,
  getTopProducts,
  getWarehouseUtilization,
  getOrderVelocity,
} from "@/modules/analytics/actions";
import { LineChartCard } from "@/components/shared/charts";
import { PieChartCard } from "@/components/shared/charts";
import { BarChartCard } from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fallback = {
  throughput: [] as { date: string; received: number; shipped: number }[],
  sla: { onTime: 0, late: 0, noSla: 0 },
  heatmap: { days: [] as string[], rows: [] as { label: string; values: number[] }[] },
  topProducts: [] as { sku: string; name: string; picks: number }[],
  utilization: [] as {
    zoneType: string;
    total: number;
    occupied: number;
    available: number;
    utilizationPct: number;
  }[],
  velocity: [] as { week: string; avgHours: number; orders: number }[],
};

export default async function AnalyticsPage() {
  const t = await getTranslations("tenant.analytics");

  const [throughput, sla, heatmap, topProducts, utilization, velocity] = await Promise.all([
    getThroughputTrend(30).catch(() => fallback.throughput),
    getSlaCompliance().catch(() => fallback.sla),
    getExceptionHeatmap().catch(() => fallback.heatmap),
    getTopProducts(10).catch(() => fallback.topProducts),
    getWarehouseUtilization().catch(() => fallback.utilization),
    getOrderVelocity().catch(() => fallback.velocity),
  ]);

  // Transform throughput for LineChartCard (received line)
  const receivedData = throughput.map((d) => ({ name: d.date, value: d.received }));
  const shippedData = throughput.map((d) => ({ name: d.date, value: d.shipped }));

  // Transform SLA for PieChartCard
  const slaData = [
    { name: t("onTime"), value: sla.onTime },
    { name: t("late"), value: sla.late },
    { name: t("noSla"), value: sla.noSla },
  ].filter((d) => d.value > 0);

  // Transform top products for BarChartCard
  const topProductsData = topProducts.map((p) => ({ name: p.sku, value: p.picks }));

  // Transform utilization for BarChartCard
  const utilizationData = utilization.map((u) => ({
    name: u.zoneType,
    value: u.utilizationPct,
  }));

  // Transform velocity for LineChartCard
  const velocityData = velocity.map((v) => ({ name: v.week, value: v.avgHours }));

  // Heatmap max for color scaling
  const heatmapMax = Math.max(1, ...heatmap.rows.flatMap((r) => r.values));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Row 1: Throughput + SLA */}
      <div className="grid gap-4 md:grid-cols-2">
        {receivedData.length > 0 ? (
          <LineChartCard title={`${t("throughput")} (${t("received")})`} data={receivedData} />
        ) : (
          <EmptyCard title={t("throughput")} message={t("noData")} />
        )}

        {shippedData.length > 0 ? (
          <LineChartCard
            title={`${t("throughput")} (${t("shipped")})`}
            data={shippedData}
            color="hsl(160, 60%, 45%)"
          />
        ) : (
          <EmptyCard title={t("throughput")} message={t("noData")} />
        )}
      </div>

      {/* Row 2: SLA Compliance + Top Products */}
      <div className="grid gap-4 md:grid-cols-2">
        {slaData.length > 0 ? (
          <PieChartCard title={t("slaCompliance")} data={slaData} />
        ) : (
          <EmptyCard title={t("slaCompliance")} message={t("noData")} />
        )}

        {topProductsData.length > 0 ? (
          <BarChartCard title={t("topProducts")} data={topProductsData} />
        ) : (
          <EmptyCard title={t("topProducts")} message={t("noData")} />
        )}
      </div>

      {/* Row 3: Exception Heatmap + Utilization */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("exceptions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {heatmap.rows.length > 0 ? (
              <div className="space-y-3">
                {/* Day headers */}
                <div className="grid grid-cols-8 gap-1 text-xs text-muted-foreground">
                  <div />
                  {heatmap.days.map((day) => (
                    <div key={day} className="text-center font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Heatmap rows */}
                {heatmap.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-8 gap-1 items-center">
                    <div className="text-xs font-medium truncate">{row.label}</div>
                    {row.values.map((val, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor:
                            val === 0
                              ? "hsl(var(--muted))"
                              : `hsl(0, ${Math.round((val / heatmapMax) * 70 + 10)}%, ${Math.round(55 - (val / heatmapMax) * 15)}%)`,
                          color: val > heatmapMax * 0.5 ? "white" : undefined,
                        }}
                      >
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </CardContent>
        </Card>

        {utilizationData.length > 0 ? (
          <BarChartCard
            title={t("utilization")}
            data={utilizationData}
            color="hsl(280, 60%, 55%)"
          />
        ) : (
          <EmptyCard title={t("utilization")} message={t("noData")} />
        )}
      </div>

      {/* Row 4: Order Velocity */}
      <div className="grid gap-4 md:grid-cols-1">
        {velocityData.length > 0 ? (
          <LineChartCard title={t("orderVelocity")} data={velocityData} color="hsl(40, 90%, 55%)" />
        ) : (
          <EmptyCard title={t("orderVelocity")} message={t("noData")} />
        )}
      </div>
    </div>
  );
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
