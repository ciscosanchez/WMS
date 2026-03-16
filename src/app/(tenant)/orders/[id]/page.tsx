import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Package, Truck, MapPin, User, Clock } from "lucide-react";
import { format } from "date-fns";

const mockOrder = {
  id: "2",
  orderNumber: "ORD-2026-0002",
  externalId: "#AMZ-9982",
  channel: "Amazon",
  clientCode: "ACME",
  clientName: "Acme Corporation",
  status: "picking",
  priority: "expedited",
  shipToName: "Robert Fox",
  shipToAddress: "456 Oak Ave",
  shipToCity: "Denver",
  shipToState: "CO",
  shipToZip: "80202",
  shipToCountry: "US",
  shipToPhone: "555-0199",
  shipToEmail: "robert@example.com",
  shippingMethod: "2-Day",
  orderDate: new Date("2026-03-15"),
  shipByDate: new Date("2026-03-16"),
  notes: "Gift wrap requested",
  lines: [
    {
      id: "ol1",
      sku: "VALVE-BV2",
      name: '2" Ball Valve',
      quantity: 1,
      pickedQty: 0,
      packedQty: 0,
      unitPrice: 24.99,
    },
  ],
  pickTask: {
    taskNumber: "PICK-2026-0012",
    status: "in_progress",
    assignedTo: "Carlos M.",
    startedAt: new Date("2026-03-16T10:30:00"),
  },
  shipments: [],
  timeline: [
    { event: "Order received from Amazon", at: new Date("2026-03-15T14:22:00"), by: "System" },
    {
      event: "Inventory allocated",
      at: new Date("2026-03-15T14:22:05"),
      by: "System",
    },
    {
      event: "Pick task PICK-2026-0012 created",
      at: new Date("2026-03-16T09:00:00"),
      by: "System",
    },
    {
      event: "Pick task assigned to Carlos M.",
      at: new Date("2026-03-16T10:30:00"),
      by: "Carlos M.",
    },
  ],
};

export default function OrderDetailPage() {
  const order = mockOrder;
  const total = order.lines.reduce((s, l) => s + l.quantity * (l.unitPrice || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={order.orderNumber}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{order.channel}</Badge>
          {order.externalId && (
            <span className="text-sm text-muted-foreground">{order.externalId}</span>
          )}
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
            {order.priority}
          </Badge>
          <StatusBadge status={order.status} />
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Client</span>
            </div>
            <p className="mt-1 font-medium">{order.clientName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Items</span>
            </div>
            <p className="mt-1 font-medium">
              {order.lines.reduce((s, l) => s + l.quantity, 0)} items &middot; ${total.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Shipping</span>
            </div>
            <p className="mt-1 font-medium">{order.shippingMethod}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ship By</span>
            </div>
            <p className="mt-1 font-medium">{format(order.shipByDate, "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ship-to + Pick Task */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ship To
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.shipToName}</p>
            <p>{order.shipToAddress}</p>
            <p>
              {order.shipToCity}, {order.shipToState} {order.shipToZip}
            </p>
            {order.shipToPhone && <p>{order.shipToPhone}</p>}
            {order.shipToEmail && <p>{order.shipToEmail}</p>}
          </CardContent>
        </Card>

        {order.pickTask && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Pick Task
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{order.pickTask.taskNumber}</span>
                <StatusBadge status={order.pickTask.status} />
              </div>
              <p>Assigned to: {order.pickTask.assignedTo}</p>
              <p>Started: {format(order.pickTask.startedAt, "MMM d, HH:mm")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Lines ({order.lines.length})</TabsTrigger>
          <TabsTrigger value="shipments">Shipments ({order.shipments.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({order.timeline.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Picked</TableHead>
                  <TableHead className="text-right">Packed</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono">{line.sku}</TableCell>
                    <TableCell>{line.name}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">{line.pickedQty}</TableCell>
                    <TableCell className="text-right">{line.packedQty}</TableCell>
                    <TableCell className="text-right">
                      ${(line.unitPrice || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(line.quantity * (line.unitPrice || 0)).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="shipments">
          <p className="py-8 text-center text-sm text-muted-foreground">
            No shipments yet — order is still being picked
          </p>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-4 py-4">
            {order.timeline.map((event, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  {i < order.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium">{event.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(event.at, "MMM d, yyyy HH:mm")} &middot; {event.by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button>Generate Pick Task</Button>
        <Button variant="outline">Cancel Order</Button>
      </div>
    </div>
  );
}
