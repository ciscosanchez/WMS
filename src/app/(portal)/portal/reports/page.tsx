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
import { useTranslations } from "next-intl";

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
  preparingText,
  downloadText,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  preparingText: string;
  downloadText: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      {disabled ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {disabled ? preparingText : downloadText}
    </Button>
  );
}

export default function PortalReportsPage() {
  const t = useTranslations("portal.reports");
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
      title: t("inventorySnapshot"),
      description: t("inventorySnapshotDesc"),
      icon: Package,
      onDownload: () => download(t("inventorySnapshot"), downloadInventory),
    },
    {
      title: t("activitySummary"),
      description: t("activitySummaryDesc"),
      icon: Activity,
      onDownload: () => download(t("activitySummary"), downloadActivity),
    },
    {
      title: t("billingDetail"),
      description: t("billingDetailDesc"),
      icon: Receipt,
      onDownload: () => download(t("billingDetail"), downloadBilling),
    },
    {
      title: t("shipmentHistory"),
      description: t("shipmentHistoryDesc"),
      icon: Truck,
      onDownload: () => download(t("shipmentHistory"), downloadShipments),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

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
                  preparingText={t("preparing")}
                  downloadText={t("downloadCsv")}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
