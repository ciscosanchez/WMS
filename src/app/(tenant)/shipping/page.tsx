import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
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

const mockShipments = [
  {
    id: "1",
    shipmentNumber: "SHP-2026-0008",
    orderNumber: "ORD-2026-0001",
    carrier: "FedEx",
    service: "Ground",
    tracking: "794644790132",
    status: "shipped",
    weight: "2.4 lb",
    cost: "$8.95",
    shippedAt: new Date("2026-03-12"),
  },
  {
    id: "2",
    shipmentNumber: "SHP-2026-0009",
    orderNumber: "ORD-2026-0006",
    carrier: "UPS",
    service: "2nd Day Air",
    tracking: null,
    status: "label_created",
    weight: "15.2 lb",
    cost: "$24.50",
    shippedAt: null,
  },
  {
    id: "3",
    shipmentNumber: "SHP-2026-0007",
    orderNumber: "ORD-2026-0001",
    carrier: "USPS",
    service: "Priority",
    tracking: "9400111899223456789012",
    status: "delivered",
    weight: "0.8 lb",
    cost: "$7.15",
    shippedAt: new Date("2026-03-11"),
  },
];

export default function ShippingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Shipping" description="Outbound shipments, labels, and tracking" />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Ready to Ship" value={3} description="Labels pending" icon={Package} />
        <KpiCard title="Shipped Today" value={5} description="Out the door" icon={Truck} />
        <KpiCard title="In Transit" value={12} description="With carriers" icon={Clock} />
        <KpiCard title="Delivered" value={47} description="This week" icon={CheckCircle} />
      </div>

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
            {mockShipments.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/shipping/${s.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.shipmentNumber}
                  </Link>
                </TableCell>
                <TableCell>{s.orderNumber}</TableCell>
                <TableCell>
                  <Badge variant="outline">{s.carrier}</Badge>
                </TableCell>
                <TableCell>{s.service}</TableCell>
                <TableCell className="font-mono text-xs">
                  {s.tracking || <span className="text-muted-foreground">Pending</span>}
                </TableCell>
                <TableCell>{s.weight}</TableCell>
                <TableCell>{s.cost}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell>{s.shippedAt ? format(s.shippedAt, "MMM d") : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
