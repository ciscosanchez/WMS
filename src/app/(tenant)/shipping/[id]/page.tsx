import { getShipment } from "@/modules/shipping/actions";
import { notFound } from "next/navigation";
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

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShipment(id);
  if (!s) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={s.shipmentNumber}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {s.carrier ?? "No carrier"} {s.service ?? ""}
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
              {s.carrier ?? "TBD"} {s.service ?? ""}
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
              {s.packageLength && s.packageWidth && s.packageHeight
                ? `${s.packageLength}\u00d7${s.packageWidth}\u00d7${s.packageHeight}" \u00b7 `
                : ""}
              {s.packageWeight ? `${s.packageWeight} lb` : "No dimensions"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cost</span>
            </div>
            <p className="mt-1 font-medium">
              {s.shippingCost ? `$${parseFloat(s.shippingCost).toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tracking</span>
            </div>
            <p className="mt-1 font-mono text-sm font-medium">{s.trackingNumber ?? "Pending"}</p>
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
            <p className="font-medium">{s.order?.shipToName ?? "-"}</p>
            <p>{s.order?.shipToAddress1}</p>
            {s.order?.shipToAddress2 && <p>{s.order.shipToAddress2}</p>}
            <p>
              {s.order?.shipToCity}, {s.order?.shipToState ?? ""} {s.order?.shipToZip}
            </p>
            {s.order?.shipToPhone && <p>{s.order.shipToPhone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Items ({(s.items ?? []).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {(s.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No items recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(s.items ?? []).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.product?.sku ?? item.sku ?? "-"}
                      </TableCell>
                      <TableCell>{item.product?.name ?? item.name ?? "-"}</TableCell>
                      <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
