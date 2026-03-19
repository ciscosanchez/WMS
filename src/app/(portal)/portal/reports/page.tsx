"use client";

import { useTransition } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Package, Activity, Receipt, Truck, Loader2 } from "lucide-react";
import { getPortalInventory, getPortalOrders, getPortalShipments } from "@/modules/portal/actions";
import { getPortalBillingData } from "@/modules/billing/actions";
import { exportToCsv } from "@/lib/export/csv";
import { toast } from "sonner";
import { format } from "date-fns";

function useDownload() {
  const [isPending, startTransition] = useTransition();

  function download(label: string, fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast.error(`Failed to download ${label}`);
      }
    });
  }

  return { isPending, download };
}

function DownloadButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      {disabled ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {disabled ? "Preparing…" : "Download CSV"}
    </Button>
  );
}

export default function PortalReportsPage() {
  const { isPending, download } = useDownload();

  async function downloadInventory() {
    const data = await getPortalInventory();
    const headers = ["SKU", "Product", "UOM", "On Hand", "Allocated", "Available", "Location"];
    const rows = data.map((item: { sku: string; name: string; uom: string; onHand: number; allocated: number; available: number; location: string }) => [
      item.sku,
      item.name,
      item.uom,
      String(item.onHand),
      String(item.allocated),
      String(item.available),
      item.location,
    ]);
    exportToCsv(`inventory-snapshot-${format(new Date(), "yyyy-MM-dd")}`, headers, rows);
  }

  async function downloadActivity() {
    const [orders, shipments] = await Promise.all([getPortalOrders(), getPortalShipments()]);
    const headers = ["Type", "Number", "Status", "Date", "Items / Tracking"];
    const rows = [
      ...orders.map((o: { orderNumber: string; status: string; orderDate: string | Date | null; totalItems: number }) => [
        "Order",
        o.orderNumber,
        o.status,
        o.orderDate ? format(new Date(o.orderDate), "yyyy-MM-dd") : "",
        String(o.totalItems),
      ]),
      ...shipments.map((s: { shipmentNumber: string; status: string; shippedAt: string | Date | null; trackingNumber: string | null }) => [
        "Shipment",
        s.shipmentNumber,
        s.status,
        s.shippedAt ? format(new Date(s.shippedAt), "yyyy-MM-dd") : "",
        s.trackingNumber ?? "",
      ]),
    ];
    exportToCsv(`activity-summary-${format(new Date(), "yyyy-MM-dd")}`, headers, rows);
  }

  async function downloadBilling() {
    const data = await getPortalBillingData();
    if (!data) { toast.error("No billing data available"); return; }
    const headers = ["Invoice #", "Period Start", "Period End", "Status", "Amount", "Due Date"];
    const rows = data.invoices.map((inv: { invoiceNumber: string; periodStart: string | Date; periodEnd: string | Date; status: string; total: number | string; dueDate: string | Date | null }) => [
      inv.invoiceNumber,
      format(new Date(inv.periodStart), "yyyy-MM-dd"),
      format(new Date(inv.periodEnd), "yyyy-MM-dd"),
      inv.status,
      String(Number(inv.total).toFixed(2)),
      inv.dueDate ? format(new Date(inv.dueDate), "yyyy-MM-dd") : "",
    ]);
    exportToCsv(`billing-detail-${format(new Date(), "yyyy-MM-dd")}`, headers, rows);
  }

  async function downloadShipments() {
    const shipments = await getPortalShipments();
    const headers = ["Shipment #", "Order", "Carrier", "Tracking Number", "Status", "Shipped Date"];
    const rows = shipments.map((s: { shipmentNumber: string; orderNumber: string; carrier: string; trackingNumber: string | null; status: string; shippedAt: string | Date | null }) => [
      s.shipmentNumber,
      s.orderNumber,
      s.carrier,
      s.trackingNumber ?? "",
      s.status,
      s.shippedAt ? format(new Date(s.shippedAt), "yyyy-MM-dd") : "",
    ]);
    exportToCsv(`shipment-history-${format(new Date(), "yyyy-MM-dd")}`, headers, rows);
  }

  const reports = [
    {
      title: "Inventory Snapshot",
      description:
        "Current on-hand, allocated, and available quantities for all your products. Includes location details.",
      icon: Package,
      onDownload: () => download("Inventory Snapshot", downloadInventory),
    },
    {
      title: "Activity Summary",
      description:
        "All orders and shipments including statuses, dates, and tracking numbers.",
      icon: Activity,
      onDownload: () => download("Activity Summary", downloadActivity),
    },
    {
      title: "Billing Detail",
      description: "Itemized invoices with amounts, periods, and payment status.",
      icon: Receipt,
      onDownload: () => download("Billing Detail", downloadBilling),
    },
    {
      title: "Shipment History",
      description:
        "Complete history of all shipments with carrier, tracking, and delivery status.",
      icon: Truck,
      onDownload: () => download("Shipment History", downloadShipments),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Download reports for your account" />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle>{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription>{report.description}</CardDescription>
                <DownloadButton
                  label={report.title}
                  onClick={report.onDownload}
                  disabled={isPending}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
