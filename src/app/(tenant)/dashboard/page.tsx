import { KpiCard } from "@/components/shared/kpi-card";
import { PackageOpen, PackageCheck, Boxes, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockTransactions = [
  {
    id: "1",
    type: "receive",
    product: { sku: "WIDGET-001" },
    quantity: 50,
    toBin: { barcode: "WH1-A-01-01-01-01" },
    performedAt: new Date(),
  },
  {
    id: "2",
    type: "putaway",
    product: { sku: "GADGET-001" },
    quantity: 25,
    toBin: { barcode: "WH1-A-01-01-01-03" },
    performedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    type: "move",
    product: { sku: "PART-A100" },
    quantity: 100,
    toBin: { barcode: "WH1-A-01-01-02-01" },
    performedAt: new Date(Date.now() - 7200000),
  },
  {
    id: "4",
    type: "receive",
    product: { sku: "BOLT-M8X40" },
    quantity: 500,
    toBin: { barcode: "WH1-B-02-01-01-05" },
    performedAt: new Date(Date.now() - 10800000),
  },
  {
    id: "5",
    type: "adjust",
    product: { sku: "WIDGET-001" },
    quantity: -2,
    toBin: { barcode: "WH1-A-01-01-01-01" },
    performedAt: new Date(Date.now() - 86400000),
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your warehouse operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Pending Receipts"
          value={3}
          description="Shipments awaiting processing"
          icon={PackageOpen}
        />
        <KpiCard
          title="Received Today"
          value={12}
          description="Items received today"
          icon={PackageCheck}
        />
        <KpiCard title="Total SKUs" value={47} description="Active products" icon={Boxes} />
        <KpiCard
          title="Available Bins"
          value={128}
          description="Storage locations available"
          icon={MapPin}
        />
        <KpiCard
          title="Low Stock Alerts"
          value={2}
          description="Products below minimum"
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} &mdash; {tx.product.sku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.quantity} units
                    {tx.toBin && ` → ${tx.toBin.barcode}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {tx.performedAt.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
