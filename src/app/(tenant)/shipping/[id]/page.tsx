import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Package, MapPin, DollarSign, Printer, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const mockShipment = {
  id: "1",
  shipmentNumber: "SHP-2026-0008",
  orderNumber: "ORD-2026-0001",
  clientCode: "ACME",
  clientName: "Acme Corporation",
  status: "shipped",
  carrier: "FedEx",
  service: "Ground",
  trackingNumber: "794644790132",
  labelUrl: "/labels/SHP-2026-0008.pdf",
  packageWeight: 2.4,
  packageLength: 12,
  packageWidth: 10,
  packageHeight: 8,
  shippingCost: 8.95,
  shippedAt: new Date("2026-03-12T14:30:00"),
  createdAt: new Date("2026-03-12T13:15:00"),
  shipTo: {
    name: "Jane Cooper",
    address: "789 Oak Ave",
    city: "Austin",
    state: "TX",
    zip: "78701",
    country: "US",
    phone: "555-0188",
  },
  items: [
    { sku: "WIDGET-001", name: "Standard Widget", quantity: 2 },
    { sku: "GADGET-001", name: "Premium Gadget", quantity: 1 },
  ],
  timeline: [
    { event: "Shipment created", at: new Date("2026-03-12T13:15:00") },
    { event: "Label generated — FedEx Ground", at: new Date("2026-03-12T13:16:00") },
    { event: "Picked up by FedEx", at: new Date("2026-03-12T14:30:00") },
    { event: "In transit — Memphis TN hub", at: new Date("2026-03-13T06:00:00") },
    { event: "Out for delivery", at: new Date("2026-03-14T08:30:00") },
    { event: "Delivered — signed by J. Cooper", at: new Date("2026-03-14T14:22:00") },
  ],
};

export default function ShipmentDetailPage() {
  const s = mockShipment;

  return (
    <div className="space-y-6">
      <PageHeader title={s.shipmentNumber}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {s.carrier} {s.service}
          </Badge>
          <StatusBadge status={s.status} />
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Reprint Label
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Carrier</span>
            </div>
            <p className="mt-1 font-medium">
              {s.carrier} {s.service}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Package</span>
            </div>
            <p className="mt-1 font-medium">
              {s.packageLength}&times;{s.packageWidth}&times;{s.packageHeight}&quot; &middot;{" "}
              {s.packageWeight} lb
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cost</span>
            </div>
            <p className="mt-1 font-medium">${s.shippingCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tracking</span>
            </div>
            <p className="mt-1 font-mono text-sm font-medium">{s.trackingNumber}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ship To
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{s.shipTo.name}</p>
            <p>{s.shipTo.address}</p>
            <p>
              {s.shipTo.city}, {s.shipTo.state} {s.shipTo.zip}
            </p>
            <p>{s.shipTo.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Items ({s.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.items.map((item) => (
                  <TableRow key={item.sku}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracking Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {s.timeline.map((event, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${i === s.timeline.length - 1 ? "bg-green-500" : "bg-primary"}`}
                  />
                  {i < s.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium">{event.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(event.at, "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
