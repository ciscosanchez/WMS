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

const mockShipments = [
  {
    id: "1",
    shipmentNumber: "SHP-2026-0010",
    orderNumber: "ORD-2026-0001",
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    status: "delivered",
    shippedDate: new Date("2026-03-11"),
  },
  {
    id: "2",
    shipmentNumber: "SHP-2026-0014",
    orderNumber: "ORD-2026-0005",
    carrier: "FedEx",
    trackingNumber: "794644790138",
    status: "shipped",
    shippedDate: new Date("2026-03-15"),
  },
  {
    id: "3",
    shipmentNumber: "SHP-2026-0016",
    orderNumber: "ORD-2026-0012",
    carrier: "USPS",
    trackingNumber: "9400111899223100001234",
    status: "label_created",
    shippedDate: null,
  },
];

export default function PortalShipmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Shipments" description="Track shipments for your orders" />

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
            {mockShipments.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
                <TableCell>{shipment.orderNumber}</TableCell>
                <TableCell>{shipment.carrier}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{shipment.trackingNumber}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={shipment.status} />
                </TableCell>
                <TableCell>
                  {shipment.shippedDate ? format(shipment.shippedDate, "MMM d, yyyy") : "--"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
