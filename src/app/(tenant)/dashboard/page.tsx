import { requireTenantContext } from "@/lib/tenant/context";
import { KpiCard } from "@/components/shared/kpi-card";
import { DashboardCharts } from "@/components/shared/dashboard-charts";
import { LiveKpiStrip } from "@/components/dashboard/live-kpi-strip";
import { getDashboardChartData } from "@/modules/dashboard/actions";
import { PackageOpen, PackageCheck, Boxes, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

async function getDashboardData() {
  const { tenant } = await requireTenantContext("reports:read");
  const db = tenant.db;

  const [pendingReceipts, receivedToday, totalSkus, availableBins, lowStockAlerts, transactions] =
    await Promise.all([
      db.inboundShipment.count({
        where: { status: { in: ["expected", "arrived", "receiving"] } },
      }),
      db.receivingTransaction.count({
        where: { receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      db.product.count({ where: { isActive: true } }),
      db.bin.count({ where: { status: "available" } }),
      // Low-stock: products where total available inventory < minStock
      db.product
        .findMany({
          where: { isActive: true, minStock: { not: null } },
          select: { id: true, minStock: true, inventory: { select: { available: true } } },
        })
        .then(
          (
            products: Array<{
              id: string;
              minStock: number | null;
              inventory: Array<{ available: number }>;
            }>
          ) =>
            products.filter(
              (p: {
                id: string;
                minStock: number | null;
                inventory: Array<{ available: number }>;
              }) => {
                const totalAvailable = p.inventory.reduce(
                  (sum: number, inv: { available: number }) => sum + inv.available,
                  0
                );
                return totalAvailable < (p.minStock ?? 0);
              }
            ).length
        ),
      db.inventoryTransaction.findMany({
        include: { product: true, toBin: true },
        orderBy: { performedAt: "desc" },
        take: 10,
      }),
    ]);

  return {
    pendingReceipts,
    receivedToday,
    totalSkus,
    availableBins,
    lowStockAlerts,
    recentActivity: transactions.map(
      (tx: {
        id: string;
        type: string;
        product: { sku: string };
        quantity: number;
        toBin: { barcode: string } | null;
        performedAt: Date;
      }) => ({
        id: tx.id,
        type: tx.type,
        sku: tx.product.sku,
        quantity: tx.quantity,
        bin: tx.toBin?.barcode || "-",
        at: tx.performedAt,
      })
    ),
  };
}

const fallbackCharts = {
  receivingVolume: [],
  ordersByStatus: [],
  zoneUtilization: [],
  fulfillmentThroughput: [],
};

export default async function DashboardPage() {
  const t = await getTranslations("tenant.dashboard");
  const [data, chartData] = await Promise.all([
    getDashboardData(),
    getDashboardChartData().catch(() => fallbackCharts),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title={t("pendingReceipts")}
          value={data.pendingReceipts}
          description={t("pendingReceiptsDesc")}
          icon={PackageOpen}
        />
        <KpiCard
          title={t("receivedToday")}
          value={data.receivedToday}
          description={t("receivedTodayDesc")}
          icon={PackageCheck}
        />
        <KpiCard
          title={t("totalSkus")}
          value={data.totalSkus}
          description={t("totalSkusDesc")}
          icon={Boxes}
        />
        <KpiCard
          title={t("availableBins")}
          value={data.availableBins}
          description={t("availableBinsDesc")}
          icon={MapPin}
        />
        <KpiCard
          title={t("lowStockAlerts")}
          value={data.lowStockAlerts}
          description={t("lowStockAlertsDesc")}
          icon={AlertTriangle}
        />
      </div>

      {/* Live KPI Strip — real-time SSE counters */}
      <LiveKpiStrip />

      {/* Charts */}
      <DashboardCharts
        receivingVolume={chartData.receivingVolume}
        ordersByStatus={chartData.ordersByStatus}
        zoneUtilization={chartData.zoneUtilization}
        fulfillmentThroughput={chartData.fulfillmentThroughput}
        labels={{
          receivingVolume: t("receivingVolume"),
          ordersByStatus: t("ordersByStatus"),
          occupiedBinsByZone: t("occupiedBinsByZone"),
          fulfillmentThroughput: t("fulfillmentThroughput"),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map(
                (tx: {
                  id: string;
                  type: string;
                  sku: string;
                  quantity: number;
                  bin: string;
                  at: Date;
                }) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} &mdash; {tx.sku}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.quantity} units {tx.bin !== "-" && `→ ${tx.bin}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.at).toLocaleString()}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
