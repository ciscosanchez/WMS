"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { ShoppingCart, Package, Truck, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getOrder, updateOrderStatus } from "@/modules/orders/actions";

const orderStatusFlow: Record<string, { next: string; label: string; confirm?: string }> = {
  pending: { next: "awaiting_fulfillment", label: "Accept Order" },
  awaiting_fulfillment: { next: "allocated", label: "Allocate Inventory" },
  allocated: { next: "picking", label: "Generate Pick Task" },
  picking: { next: "picked", label: "Mark Picked" },
  picked: { next: "packing", label: "Start Packing" },
  packing: { next: "packed", label: "Mark Packed" },
  packed: { next: "shipped", label: "Ship Order", confirm: "Create shipment and mark as shipped?" },
  shipped: { next: "delivered", label: "Mark Delivered" },
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getOrder(params.id)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (!order) {
    return <div className="py-10 text-center text-muted-foreground">Order not found</div>;
  }

  const flow = orderStatusFlow[order.status];
  const total = (order.lines ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, l: any) => s + l.quantity * (parseFloat(l.unitPrice) || 0),
    0
  );

  async function handleStatusChange() {
    if (!flow) return;
    if (flow.confirm && !confirm(flow.confirm)) return;

    setProcessing(true);
    try {
      const updated = await updateOrderStatus(order.id, flow.next);
      setOrder((prev: typeof order) => ({ ...prev, status: updated.status ?? flow.next }));
      toast.success(flow.label);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this order? Allocated inventory will be released.")) return;
    setProcessing(true);
    try {
      await updateOrderStatus(order.id, "cancelled");
      setOrder((prev: typeof order) => ({ ...prev, status: "cancelled" }));
      toast.success("Order cancelled");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setProcessing(false);
    }
  }

  const shipByDate = order.shipByDate ? new Date(order.shipByDate) : null;
  const isShipByOverdue =
    shipByDate &&
    shipByDate < new Date() &&
    !["shipped", "delivered", "cancelled"].includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader title={order.orderNumber}>
        <div className="flex items-center gap-2">
          {order.externalId && (
            <span className="text-sm text-muted-foreground">{order.externalId}</span>
          )}
          <Badge
            variant="outline"
            className={
              order.priority === "rush"
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : order.priority === "expedited"
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : ""
            }
          >
            {order.priority}
          </Badge>
          <StatusBadge status={order.status} />
          {flow && !["cancelled", "delivered"].includes(order.status) && (
            <>
              <Button onClick={handleStatusChange} disabled={processing}>
                {processing ? "Processing..." : flow.label}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={processing}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {isShipByOverdue && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Overdue!</strong> This order was due to ship by{" "}
          {format(shipByDate, "MMM d, yyyy")}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Client</span>
            </div>
            <p className="mt-1 font-medium">{order.client?.name ?? order.clientName ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Items</span>
            </div>
            <p className="mt-1 font-medium">
              {(order.lines ?? []).reduce(
                (s: number, l: { quantity: number }) => s + l.quantity,
                0
              )}{" "}
              items{total > 0 ? ` \u00b7 $${total.toFixed(2)}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Shipping</span>
            </div>
            <p className="mt-1 font-medium">
              {order.requestedService ?? order.shippingMethod ?? "Best available"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock
                className={`h-4 w-4 ${isShipByOverdue ? "text-red-500" : "text-muted-foreground"}`}
              />
              <span className="text-sm text-muted-foreground">Ship By</span>
            </div>
            <p className={`mt-1 font-medium ${isShipByOverdue ? "text-red-600" : ""}`}>
              {shipByDate ? format(shipByDate, "MMM d, yyyy") : "No deadline"}
            </p>
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
            <p className="font-medium">{order.shipToName}</p>
            <p>{order.shipToAddress1}</p>
            {order.shipToAddress2 && <p>{order.shipToAddress2}</p>}
            <p>
              {order.shipToCity}, {order.shipToState ?? ""} {order.shipToZip}
            </p>
            {order.shipToPhone && <p>{order.shipToPhone}</p>}
            {order.shipToEmail && <p>{order.shipToEmail}</p>}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Lines ({(order.lines ?? []).length})</TabsTrigger>
          <TabsTrigger value="shipments">Shipments ({(order.shipments ?? []).length})</TabsTrigger>
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(order.lines ?? []).map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono">
                      {line.product?.sku ?? line.sku ?? "-"}
                    </TableCell>
                    <TableCell>{line.product?.name ?? line.name ?? "-"}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">{line.pickedQty ?? 0}</TableCell>
                    <TableCell className="text-right">{line.packedQty ?? 0}</TableCell>
                    <TableCell className="text-right">
                      ${(parseFloat(line.unitPrice) || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(line.quantity * (parseFloat(line.unitPrice) || 0)).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="shipments">
          {(order.shipments ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No shipments yet — order is still being processed
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment #</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {order.shipments.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.shipmentNumber}</TableCell>
                      <TableCell>{s.carrier ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.trackingNumber ?? "Pending"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
    </div>
  );
}
