"use client";

import { BarChartCard, PieChartCard, LineChartCard } from "./charts";

const receivingVolume = [
  { name: "Mar 1", value: 12 },
  { name: "Mar 3", value: 8 },
  { name: "Mar 5", value: 15 },
  { name: "Mar 7", value: 22 },
  { name: "Mar 9", value: 18 },
  { name: "Mar 11", value: 25 },
  { name: "Mar 13", value: 14 },
  { name: "Mar 15", value: 30 },
  { name: "Mar 16", value: 12 },
];

const ordersByStatus = [
  { name: "Pending", value: 5 },
  { name: "Picking", value: 3 },
  { name: "Packed", value: 2 },
  { name: "Shipped", value: 18 },
  { name: "Delivered", value: 47 },
];

const zoneUtilization = [
  { name: "Zone A", value: 72 },
  { name: "Zone B", value: 85 },
  { name: "Staging", value: 25 },
  { name: "Cold", value: 60 },
  { name: "Dock", value: 38 },
];

const fulfillmentThroughput = [
  { name: "Mon", value: 45 },
  { name: "Tue", value: 52 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 65 },
  { name: "Fri", value: 58 },
  { name: "Sat", value: 22 },
  { name: "Sun", value: 8 },
];

export function DashboardCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LineChartCard title="Receiving Volume (Items/Day)" data={receivingVolume} />
      <PieChartCard title="Orders by Status" data={ordersByStatus} />
      <BarChartCard
        title="Zone Utilization (%)"
        data={zoneUtilization}
        color="hsl(160, 60%, 45%)"
      />
      <BarChartCard
        title="Fulfillment Throughput (Orders/Day)"
        data={fulfillmentThroughput}
        color="hsl(220, 70%, 55%)"
      />
    </div>
  );
}
