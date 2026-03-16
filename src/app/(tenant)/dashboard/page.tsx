import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { KpiCard } from "@/components/shared/kpi-card";
import { DashboardCharts } from "@/components/shared/dashboard-charts";
import { PackageOpen, PackageCheck, Boxes, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockActivity = [
  {
    id: "1",
    type: "receive",
    sku: "WIDGET-001",
    quantity: 50,
    bin: "WH1-A-01-01-01-01",
    at: new Date(),
  },
  {
    id: "2",
    type: "putaway",
    sku: "GADGET-001",
    quantity: 25,
    bin: "WH1-A-01-01-01-03",
    at: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    type: "move",
    sku: "PART-A100",
    quantity: 100,
    bin: "WH1-A-01-01-02-01",
    at: new Date(Date.now() - 7200000),
  },
  {
    id: "4",
    type: "receive",
    sku: "BOLT-M8X40",
    quantity: 500,
    bin: "WH1-B-02-01-01-05",
    at: new Date(Date.now() - 10800000),
  },
  {
    id: "5",
    type: "adjust",
    sku: "WIDGET-001",
    quantity: -2,
    bin: "WH1-A-01-01-01-01",
    at: new Date(Date.now() - 86400000),
  },
];

async function getDashboardData() {
  if (config.useMockData) {
    return {
      pendingReceipts: 3,
      receivedToday: 12,
      totalSkus: 47,
      availableBins: 128,
      lowStockAlerts: 2,
      recentActivity: mockActivity,
    };
  }

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
      db.product.count({
        where: { isActive: true, minStock: { not: null }, inventory: { some: {} } },
      }),
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

export default async function DashboardPage() {
  const data = await getDashboardData();
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
      <DashboardCharts />

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
