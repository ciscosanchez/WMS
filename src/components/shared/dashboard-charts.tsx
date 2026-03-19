"use client";

import { BarChartCard, PieChartCard, LineChartCard } from "./charts";

interface ChartDataPoint {
  name: string;
  value: number;
}

interface DashboardChartsProps {
  receivingVolume: ChartDataPoint[];
  ordersByStatus: ChartDataPoint[];
  zoneUtilization: ChartDataPoint[];
  fulfillmentThroughput: ChartDataPoint[];
}

export function DashboardCharts({
  receivingVolume,
  ordersByStatus,
  zoneUtilization,
  fulfillmentThroughput,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LineChartCard title="Receiving Volume (Items/Day)" data={receivingVolume} />
      <PieChartCard title="Orders by Status" data={ordersByStatus} />
      <BarChartCard
        title="Occupied Bins by Zone"
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
