import { getShipment } from "@/modules/shipping/actions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Package, MapPin, DollarSign, ExternalLink } from "lucide-react";
import { MarkShippedForm } from "@/components/shipping/mark-shipped-form";
import { RateShoppingCard } from "@/components/shipping/rate-shopping-card";
import { GenerateLabelButton, ReprintLabelButton } from "@/components/shipping/label-buttons";
import { getTranslations } from "next-intl/server";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("tenant.shipping");
  const { id } = await params;
  const s = await getShipment(id);
  if (!s) notFound();

  const canGenerateLabel =
    s.status !== "shipped" &&
    s.status !== "delivered" &&
    !!s.carrier &&
    !s.labelUrl;

  const hasLabel = !!s.labelUrl;

  return (
    <div className="space-y-6">
      <PageHeader title={s.shipmentNumber}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {s.carrier ?? t("noCarrier")} {s.service ?? ""}
          </Badge>
          <StatusBadge status={s.status} />
          {canGenerateLabel && <GenerateLabelButton shipmentId={s.id} />}
          {hasLabel && <ReprintLabelButton shipmentId={s.id} />}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("carrier")}</span>
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
              <span className="text-sm text-muted-foreground">{t("package")}</span>
            </div>
            <p className="mt-1 font-medium">
              {s.packageLength && s.packageWidth && s.packageHeight
                ? `${s.packageLength}\u00d7${s.packageWidth}\u00d7${s.packageHeight}" \u00b7 `
                : ""}
              {s.packageWeight ? `${s.packageWeight} lb` : t("noDimensions")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("cost")}</span>
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
              <span className="text-sm text-muted-foreground">{t("tracking")}</span>
            </div>
            <p className="mt-1 font-mono text-sm font-medium">
              {s.trackingNumber ?? t("pending")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate shopping + label generation + mark shipped */}
      {s.status !== "shipped" && s.status !== "delivered" && (
        <div className="space-y-4">
          {/* Show rate shopping if no carrier selected yet */}
          {!s.carrier && <RateShoppingCard shipmentId={s.id} />}
          {/* Show rate shopping again if carrier selected but no label (to change selection) */}
          {s.carrier && !s.labelUrl && <RateShoppingCard shipmentId={s.id} />}
          <MarkShippedForm shipmentId={s.id} currentCarrier={s.carrier} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("shipTo")}
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
            <CardTitle>{t("items")} ({(s.items ?? []).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {(s.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noItems")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sku")}</TableHead>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qty")}</TableHead>
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
