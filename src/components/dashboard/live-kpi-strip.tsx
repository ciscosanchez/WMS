"use client";

import { useMemo } from "react";
import { useEventStream } from "@/hooks/use-event-stream";
import { Card, CardContent } from "@/components/ui/card";
import { PackageCheck, PackageOpen, ListChecks, AlertTriangle } from "lucide-react";

/**
 * Live KPI strip that subscribes to the SSE event stream and shows
 * real-time counters for key warehouse metrics. Falls back to zeros
 * when the stream is unavailable.
 */

interface KpiItem {
  label: string;
  icon: React.ElementType;
  eventType: string;
  /** Direction of the count: "shipped" events bump ordersShipped, etc. */
  key: string;
}

const KPI_DEFS: KpiItem[] = [
  {
    label: "Orders Shipped Today",
    icon: PackageCheck,
    eventType: "shipment_status",
    key: "ordersShipped",
  },
  {
    label: "Items Received Today",
    icon: PackageOpen,
    eventType: "inventory_update",
    key: "itemsReceived",
  },
  {
    label: "Pick Tasks Active",
    icon: ListChecks,
    eventType: "pick_task_update",
    key: "pickTasksActive",
  },
  {
    label: "Inventory Alerts",
    icon: AlertTriangle,
    eventType: "inventory_update",
    key: "inventoryAlerts",
  },
];

function deriveCountsFromEvents(events: Array<{ type: string; data?: Record<string, unknown> }>) {
  let ordersShipped = 0;
  let itemsReceived = 0;
  let pickTasksActive = 0;
  let inventoryAlerts = 0;

  for (const event of events) {
    const data = event.data ?? {};
    switch (event.type) {
      case "shipment_status":
        if (data.status === "shipped") ordersShipped++;
        break;
      case "inventory_update":
        if (data.transactionType === "receive") {
          itemsReceived += (data.quantity as number) || 1;
        }
        if (data.alert === true) inventoryAlerts++;
        break;
      case "pick_task_update":
        if (data.status === "in_progress") pickTasksActive++;
        if (data.status === "completed") pickTasksActive = Math.max(0, pickTasksActive - 1);
        break;
    }
  }

  return { ordersShipped, itemsReceived, pickTasksActive, inventoryAlerts };
}

export function LiveKpiStrip() {
  const { events, connected } = useEventStream({
    bufferSize: 200,
  });

  const counts = useMemo(
    () => deriveCountsFromEvents(events as Array<{ type: string; data?: Record<string, unknown> }>),
    [events]
  );

  const kpiValues: Record<string, number> = counts;

  return (
    <div className="relative">
      {/* Live indicator */}
      <div className="absolute -top-2 right-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
        {connected ? "Live" : "Offline"}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {KPI_DEFS.map((kpi) => {
          const Icon = kpi.icon;
          const value = kpiValues[kpi.key] ?? 0;

          return (
            <Card key={kpi.key} className="relative overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
