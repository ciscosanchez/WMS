import { resolveTenant } from "@/lib/tenant/context";
import { KpiCard } from "@/components/shared/kpi-card";
import { DashboardCharts } from "@/components/shared/dashboard-charts";
import { getDashboardChartData } from "@/modules/dashboard/actions";
import { PackageOpen, PackageCheck, Boxes, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getDashboardData() {
  const tenant = await resolveTenant();
  if (!tenant) return null;
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
      db.product.findMany({
        where: { isActive: true, minStock: { not: null } },
        select: { id: true, minStock: true, inventory: { select: { available: true } } },
      }).then((products) =>
        products.filter((p) => {
          const totalAvailable = p.inventory.reduce((sum, inv) => sum + inv.available, 0);
          return totalAvailable < (p.minStock ?? 0);
        }).length
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
    recentActivity: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      sku: tx.product.sku,
      quantity: tx.quantity,
      bin: tx.toBin?.barcode || "-",
      at: tx.performedAt,
    })),
  };
}

const fallbackCharts = {
  receivingVolume: [],
  ordersByStatus: [],
  zoneUtilization: [],
  fulfillmentThroughput: [],
};

export default async function DashboardPage() {
  const [data, chartData] = await Promise.all([
    getDashboardData(),
    getDashboardChartData().catch(() => fallbackCharts),
  ]);
  if (!data) return <div>Tenant not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your warehouse operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Pending Receipts"
          value={data.pendingReceipts}
          description="Shipments awaiting processing"
          icon={PackageOpen}
        />
        <KpiCard
          title="Received Today"
          value={data.receivedToday}
          description="Items received today"
          icon={PackageCheck}
        />
        <KpiCard
          title="Total SKUs"
          value={data.totalSkus}
          description="Active products"
          icon={Boxes}
        />
        <KpiCard
          title="Available Bins"
          value={data.availableBins}
          description="Storage locations available"
          icon={MapPin}
        />
        <KpiCard
          title="Low Stock Alerts"
          value={data.lowStockAlerts}
          description="Products below minimum"
          icon={AlertTriangle}
        />
      </div>

      {/* Charts */}
      <DashboardCharts
        receivingVolume={chartData.receivingVolume}
        ordersByStatus={chartData.ordersByStatus}
        zoneUtilization={chartData.zoneUtilization}
        fulfillmentThroughput={chartData.fulfillmentThroughput}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((tx) => (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
