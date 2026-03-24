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
import { getTranslations } from "next-intl/server";

export default async function ShippingPage() {
  const t = await getTranslations("tenant.shipping");
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
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title={t("readyToShip")}
          value={readyToShip}
          description={t("readyToShipDesc")}
          icon={Package}
        />
        <KpiCard
          title={t("shippedToday")}
          value={shippedToday}
          description={t("shippedTodayDesc")}
          icon={Truck}
        />
        <KpiCard
          title={t("inTransit")}
          value={inTransit}
          description={t("inTransitDesc")}
          icon={Clock}
        />
        <KpiCard
          title={t("delivered")}
          value={delivered}
          description={t("deliveredDesc")}
          icon={CheckCircle}
        />
      </div>

      {shipments.length === 0 ? (
        <EmptyState icon={Truck} title={t("noShipments")} description={t("noShipmentsDesc")} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("shipmentNumber")}</TableHead>
                <TableHead>{t("order")}</TableHead>
                <TableHead>{t("carrier")}</TableHead>
                <TableHead>{t("service")}</TableHead>
                <TableHead>{t("tracking")}</TableHead>
                <TableHead>{t("weight")}</TableHead>
                <TableHead>{t("cost")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("shipped")}</TableHead>
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
                    {s.trackingNumber || (
                      <span className="text-muted-foreground">{t("pending")}</span>
                    )}
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
