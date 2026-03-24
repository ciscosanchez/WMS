"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChartCard, PieChartCard, LineChartCard } from "@/components/shared/charts";
import { Download } from "lucide-react";
import { ExportButtons } from "@/components/shared/export-buttons";
import { exportToCsv } from "@/lib/export/csv";

interface ReportsClientProps {
  receiving: {
    totalShipmentsMTD: number;
    totalItemsReceived: number;
    discrepancyRate: string;
    clientVolume: { name: string; value: number }[];
  };
  inventory: {
    totalSkus: number;
    totalOnHand: number;
    totalAllocated: number;
    lowStockCount: number;
    topProducts: { sku: string; uom: string; onHand: number }[];
  };
  fulfillment: {
    ordersMTD: number;
    unitsMTD: number;
    shortPicksMTD: number;
    avgShippingCost: string;
    ordersPerDay: { name: string; value: number }[];
  };
  billing: { name: string; value: number }[];
  storageUtilTrend: { name: string; value: number }[];
  movement?: {
    totalMovesMTD: number;
    totalMovesWeek: number;
    repeatTrips: number;
    movesPerOperator: { name: string; count: number }[];
    topPaths: { path: string; count: number }[];
    movesPerDay: { name: string; value: number }[];
  };
}

export function ReportsClient({
  receiving,
  inventory,
  fulfillment,
  billing,
  storageUtilTrend,
  movement,
}: ReportsClientProps) {
  const billingTotal = billing.reduce((sum, d) => sum + d.value, 0);

  function handleExportAll() {
    const headers = ["Report", "Name", "Value"];
    const rows = [
      ...receiving.clientVolume.map((d) => ["Receiving", d.name, String(d.value)]),
      ...inventory.topProducts.map((d) => ["Inventory", d.sku, String(d.onHand)]),
      ...billing.map((d) => ["Billing", d.name, String(d.value)]),
      ...fulfillment.ordersPerDay.map((d) => ["Fulfillment", d.name, String(d.value)]),
    ];
    exportToCsv("all-reports", headers, rows);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Warehouse analytics and reporting">
        <Button variant="outline" onClick={handleExportAll}>
          <Download className="mr-2 h-4 w-4" />
          Export All CSV
        </Button>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="receiving">Receiving</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="movement">Movement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LineChartCard
              title="Storage Utilization Trend (%)"
              data={storageUtilTrend}
              color="hsl(160, 60%, 45%)"
            />
            <PieChartCard title="Revenue by Service" data={billing} />
            <BarChartCard
              title="Receiving Volume by Client"
              data={
                receiving.clientVolume.length > 0
                  ? receiving.clientVolume
                  : [{ name: "No data", value: 0 }]
              }
            />
            <BarChartCard
              title="Orders per Day"
              data={fulfillment.ordersPerDay}
              color="hsl(220, 70%, 55%)"
            />
          </div>
        </TabsContent>

        <TabsContent value="receiving" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Receiving Report"
              headers={["Client", "Shipments"]}
              rows={receiving.clientVolume.map((d) => [d.name, String(d.value)])}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard
              title="Receiving Volume by Client"
              data={
                receiving.clientVolume.length > 0
                  ? receiving.clientVolume
                  : [{ name: "No data", value: 0 }]
              }
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receiving Summary (MTD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Shipments</span>
                  <span className="font-medium">{receiving.totalShipmentsMTD}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Items Received</span>
                  <span className="font-medium">
                    {receiving.totalItemsReceived.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discrepancy Rate</span>
                  <span className="font-medium">{receiving.discrepancyRate}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Inventory Report"
              headers={["SKU", "On Hand", "UOM"]}
              rows={inventory.topProducts.map((d) => [d.sku, String(d.onHand), d.uom])}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <LineChartCard
              title="Storage Utilization Trend (%)"
              data={storageUtilTrend}
              color="hsl(160, 60%, 45%)"
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total SKUs</span>
                  <span className="font-medium">{inventory.totalSkus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Units on Hand</span>
                  <span className="font-medium">{inventory.totalOnHand.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Allocated</span>
                  <span className="font-medium">{inventory.totalAllocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low Stock Alerts</span>
                  <span
                    className={`font-medium ${inventory.lowStockCount > 0 ? "text-orange-600" : ""}`}
                  >
                    {inventory.lowStockCount}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Products by Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {inventory.topProducts.length === 0 ? (
                  <p className="text-muted-foreground">No inventory data</p>
                ) : (
                  inventory.topProducts.map((p) => (
                    <div key={p.sku} className="flex justify-between">
                      <span>{p.sku}</span>
                      <span className="font-medium">
                        {p.onHand.toLocaleString()} {p.uom}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Fulfillment Report"
              headers={["Day", "Orders"]}
              rows={fulfillment.ordersPerDay.map((d) => [d.name, String(d.value)])}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard
              title="Orders per Day (Last 7 Days)"
              data={fulfillment.ordersPerDay}
              color="hsl(220, 70%, 55%)"
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fulfillment Summary (MTD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders Shipped</span>
                  <span className="font-medium">{fulfillment.ordersMTD}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Units Shipped</span>
                  <span className="font-medium">{fulfillment.unitsMTD.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Short Picks</span>
                  <span className="font-medium">{fulfillment.shortPicksMTD}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Shipping Cost</span>
                  <span className="font-medium">{fulfillment.avgShippingCost}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Billing Report"
              headers={["Service", "Revenue ($)"]}
              rows={billing.map((d) => [d.name, String(d.value)])}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PieChartCard title="Revenue by Service (MTD)" data={billing} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing Summary (MTD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {billing.map((item) => (
                  <div key={item.name} className="flex justify-between">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">
                      ${item.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total Revenue</span>
                  <span className="font-bold">
                    ${billingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movement" className="space-y-4 pt-4">
          {movement ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Moves (MTD)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{movement.totalMovesMTD}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Moves (7 days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{movement.totalMovesWeek}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Repeat Trips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-amber-600">{movement.repeatTrips}</p>
                    <p className="text-xs text-muted-foreground">
                      Same from→to path used multiple times
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BarChartCard title="Moves per Day (7 days)" data={movement.movesPerDay} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Moves per Operator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {movement.movesPerOperator.map((op) => (
                      <div key={op.name} className="flex justify-between">
                        <span>{op.name}</span>
                        <span className="font-medium">{op.count}</span>
                      </div>
                    ))}
                    {movement.movesPerOperator.length === 0 && (
                      <p className="text-muted-foreground">No movement data.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {movement.topPaths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Bin-to-Bin Paths</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {movement.topPaths.map((p) => (
                      <div key={p.path} className="flex justify-between">
                        <span className="font-mono text-xs">{p.path}</span>
                        <span className="font-medium">{p.count}x</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Movement analytics loading...</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
