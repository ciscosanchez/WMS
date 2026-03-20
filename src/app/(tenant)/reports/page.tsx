import { getReceivingStats, getInventoryStats, getFulfillmentStats, getMovementAnalytics } from "@/modules/reports/actions";
import { getBillingSummaryMTD } from "@/modules/billing/actions";
import { ReportsClient } from "./_client";

// Static storage utilization trend — real bin-level occupancy tracking
// is a Phase 2 warehouse management feature; for now shows a representative curve
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

const billingFallback = [
  { name: "Storage", value: 0 },
  { name: "Handling", value: 0 },
  { name: "Receiving", value: 0 },
];

export default async function ReportsPage() {
  const [receiving, inventory, fulfillment, billing, movement] = await Promise.allSettled([
    getReceivingStats(),
    getInventoryStats(),
    getFulfillmentStats(),
    getBillingSummaryMTD(),
    getMovementAnalytics(),
  ]);

  return (
    <ReportsClient
      receiving={
        receiving.status === "fulfilled"
          ? receiving.value
          : { totalShipmentsMTD: 0, totalItemsReceived: 0, discrepancyRate: "—", clientVolume: [] }
      }
      inventory={
        inventory.status === "fulfilled"
          ? inventory.value
          : { totalSkus: 0, totalOnHand: 0, totalAllocated: 0, lowStockCount: 0, topProducts: [] }
      }
      fulfillment={
        fulfillment.status === "fulfilled"
          ? fulfillment.value
          : { ordersMTD: 0, unitsMTD: 0, shortPicksMTD: 0, avgShippingCost: "—", ordersPerDay: [] }
      }
      billing={billing.status === "fulfilled" && billing.value.length > 0 ? billing.value : billingFallback}
      storageUtilTrend={storageUtilTrend}
      movement={movement.status === "fulfilled" ? movement.value : undefined}
    />
  );
}
