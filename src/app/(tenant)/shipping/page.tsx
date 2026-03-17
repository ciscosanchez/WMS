import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Package, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { getShipments } from "@/modules/shipping/actions";

export default async function ShippingPage() {
  const shipments = await getShipments();

  const readyToShip = shipments.filter((s) => s.status === "label_created").length;
  const shippedToday = shipments.filter((s) => {
    if (!s.shippedAt) return false;
    const today = new Date();
    const shipped = new Date(s.shippedAt);
    return shipped.toDateString() === today.toDateString();
  }).length;
  const inTransit = shipments.filter((s) => s.status === "shipped").length;
  const delivered = shipments.filter((s) => s.status === "delivered").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Shipping" description="Outbound shipments, labels, and tracking" />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Ready to Ship"
          value={readyToShip}
          description="Labels pending"
          icon={Package}
        />
        <KpiCard
          title="Shipped Today"
          value={shippedToday}
          description="Out the door"
          icon={Truck}
        />
        <KpiCard title="In Transit" value={inTransit} description="With carriers" icon={Clock} />
        <KpiCard title="Delivered" value={delivered} description="Total" icon={CheckCircle} />
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Shipments will appear here when orders are fulfilled."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment #</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {shipments.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/shipping/${s.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.shipmentNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{s.order?.orderNumber ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.carrier ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>{s.service ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.trackingNumber || <span className="text-muted-foreground">Pending</span>}
                  </TableCell>
                  <TableCell>{s.packageWeight ? `${s.packageWeight} lb` : "-"}</TableCell>
                  <TableCell>
                    {s.shippingCost ? `$${parseFloat(s.shippingCost).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>
                    {s.shippedAt ? format(new Date(s.shippedAt), "MMM d") : "-"}
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
