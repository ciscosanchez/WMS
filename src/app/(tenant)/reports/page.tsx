"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChartCard, PieChartCard, LineChartCard } from "@/components/shared/charts";
import { Download } from "lucide-react";
import { ExportButtons } from "@/components/shared/export-buttons";
import { exportToCsv } from "@/lib/export/csv";
import { getBillingSummaryMTD } from "@/modules/billing/actions";

const receivingByClient = [
  { name: "ACME", value: 245 },
  { name: "GLOBEX", value: 180 },
  { name: "INITECH", value: 95 },
  { name: "STARK", value: 62 },
  { name: "WAYNE", value: 18 },
];

const inventoryByCategory = [
  { name: "Widgets", value: 1250 },
  { name: "Bolts/Fasteners", value: 4800 },
  { name: "Pipe/Fittings", value: 890 },
  { name: "Valves", value: 320 },
  { name: "Motors/Electrical", value: 45 },
];

const storageUtilTrend = [
  { name: "Week 1", value: 58 },
  { name: "Week 2", value: 62 },
  { name: "Week 3", value: 71 },
  { name: "Week 4", value: 68 },
  { name: "Week 5", value: 74 },
  { name: "Week 6", value: 78 },
  { name: "Week 7", value: 72 },
  { name: "Week 8", value: 76 },
];

const billingByServiceFallback = [
  { name: "Storage", value: 12400 },
  { name: "Handling", value: 8200 },
  { name: "Receiving", value: 3100 },
  { name: "Shipping", value: 5600 },
  { name: "Value-Add", value: 1800 },
];

const ordersPerDay = [
  { name: "Mon", value: 42 },
  { name: "Tue", value: 55 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 61 },
  { name: "Fri", value: 49 },
  { name: "Sat", value: 18 },
  { name: "Sun", value: 5 },
];

// --- Export data helpers ---

const receivingHeaders = ["Client", "Receiving Volume"];
const receivingRows = receivingByClient.map((d) => [d.name, String(d.value)]);

const inventoryHeaders = ["Category", "Quantity"];
const inventoryRows = inventoryByCategory.map((d) => [d.name, String(d.value)]);

const fulfillmentHeaders = ["Day", "Orders"];
const fulfillmentRows = ordersPerDay.map((d) => [d.name, String(d.value)]);

export default function ReportsPage() {
  const [billingByService, setBillingByService] = useState(billingByServiceFallback);

  useEffect(() => {
    getBillingSummaryMTD()
      .then((data) => { if (data.length > 0) setBillingByService(data); })
      .catch(() => {});
  }, []);

  const billingHeaders = ["Service", "Revenue ($)"];
  const billingRows = billingByService.map((d) => [d.name, String(d.value)]);
  const billingTotal = billingByService.reduce((sum, d) => sum + d.value, 0);

  function handleExportAll() {
    const headers = ["Report", "Name", "Value"];
    const rows = [
      ...receivingByClient.map((d) => ["Receiving", d.name, String(d.value)]),
      ...inventoryByCategory.map((d) => ["Inventory", d.name, String(d.value)]),
      ...billingByService.map((d) => ["Billing", d.name, String(d.value)]),
      ...ordersPerDay.map((d) => ["Fulfillment", d.name, String(d.value)]),
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
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LineChartCard
              title="Storage Utilization Trend (%)"
              data={storageUtilTrend}
              color="hsl(160, 60%, 45%)"
            />
            <PieChartCard title="Revenue by Service" data={billingByService} />
            <BarChartCard title="Receiving Volume by Client" data={receivingByClient} />
            <BarChartCard title="Orders per Day" data={ordersPerDay} color="hsl(220, 70%, 55%)" />
          </div>
        </TabsContent>

        <TabsContent value="receiving" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Receiving Report"
              headers={receivingHeaders}
              rows={receivingRows}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard title="Receiving Volume by Client" data={receivingByClient} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receiving Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Shipments (MTD)</span>
                  <span className="font-medium">34</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Items Received</span>
                  <span className="font-medium">2,847</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Dock-to-Stock Time</span>
                  <span className="font-medium">2.4 hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discrepancy Rate</span>
                  <span className="font-medium">1.8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Damaged Items</span>
                  <span className="font-medium">12 (0.4%)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Inventory Report"
              headers={inventoryHeaders}
              rows={inventoryRows}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PieChartCard title="Inventory by Category" data={inventoryByCategory} />
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
                  <span className="font-medium">47</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Units on Hand</span>
                  <span className="font-medium">7,305</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Allocated</span>
                  <span className="font-medium">125</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bin Utilization</span>
                  <span className="font-medium">76%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low Stock Alerts</span>
                  <span className="font-medium text-orange-600">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inventory Accuracy</span>
                  <span className="font-medium text-green-600">99.2%</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Products by Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>BOLT-M8X40</span>
                  <span className="font-medium">4,800 EA</span>
                </div>
                <div className="flex justify-between">
                  <span>WIDGET-001</span>
                  <span className="font-medium">1,250 EA</span>
                </div>
                <div className="flex justify-between">
                  <span>PIPE-SCH40</span>
                  <span className="font-medium">890 FT</span>
                </div>
                <div className="flex justify-between">
                  <span>VALVE-BV2</span>
                  <span className="font-medium">320 EA</span>
                </div>
                <div className="flex justify-between">
                  <span>MOTOR-3HP</span>
                  <span className="font-medium">45 EA</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons
              title="Fulfillment Report"
              headers={fulfillmentHeaders}
              rows={fulfillmentRows}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChartCard title="Orders per Day" data={ordersPerDay} color="hsl(220, 70%, 55%)" />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fulfillment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders (MTD)</span>
                  <span className="font-medium">268</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Units Shipped</span>
                  <span className="font-medium">1,842</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Pick Time</span>
                  <span className="font-medium">4.2 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ship-by Compliance</span>
                  <span className="font-medium text-green-600">97.4%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Short Picks</span>
                  <span className="font-medium">3 (1.1%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Shipping Cost</span>
                  <span className="font-medium">$8.42</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <ExportButtons title="Billing Report" headers={billingHeaders} rows={billingRows} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PieChartCard title="Revenue by Service (MTD)" data={billingByService} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing Summary (MTD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {billingByService.map((item) => (
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
      </Tabs>
    </div>
  );
}
