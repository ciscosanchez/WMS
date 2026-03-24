import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { getPortalShipments } from "@/modules/portal/actions";
import { Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function PortalShipmentsPage() {
  const t = await getTranslations("portal.shipments");
  const shipments = await getPortalShipments();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {shipments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noShipments")}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment #</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipped Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment: { id: string; shipmentNumber: string; orderNumber: string; carrier: string; trackingNumber: string | null; status: string; shippedAt: Date | string | null }) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
                  <TableCell>{shipment.orderNumber}</TableCell>
                  <TableCell>{shipment.carrier}</TableCell>
                  <TableCell>
                    {shipment.trackingNumber ? (
                      <span className="font-mono text-xs">{shipment.trackingNumber}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={shipment.status} />
                  </TableCell>
                  <TableCell>
                    {shipment.shippedAt ? format(new Date(shipment.shippedAt), "MMM d, yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
