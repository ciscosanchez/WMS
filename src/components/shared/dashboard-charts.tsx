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
  labels?: {
    receivingVolume: string;
    ordersByStatus: string;
    occupiedBinsByZone: string;
    fulfillmentThroughput: string;
  };
}

export function DashboardCharts({
  receivingVolume,
  ordersByStatus,
  zoneUtilization,
  fulfillmentThroughput,
  labels,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LineChartCard
        title={labels?.receivingVolume ?? "Receiving Volume (Items/Day)"}
        data={receivingVolume}
      />
      <PieChartCard title={labels?.ordersByStatus ?? "Orders by Status"} data={ordersByStatus} />
      <BarChartCard
        title={labels?.occupiedBinsByZone ?? "Occupied Bins by Zone"}
        data={zoneUtilization}
        color="hsl(160, 60%, 45%)"
      />
      <BarChartCard
        title={labels?.fulfillmentThroughput ?? "Fulfillment Throughput (Orders/Day)"}
        data={fulfillmentThroughput}
        color="hsl(220, 70%, 55%)"
      />
    </div>
  );
}
