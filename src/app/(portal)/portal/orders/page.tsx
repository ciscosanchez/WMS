import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { getPortalOrders } from "@/modules/portal/actions";
import { getTranslations } from "next-intl/server";

export default async function PortalOrdersPage() {
  const t = await getTranslations("portal.orders");
  const orders = await getPortalOrders();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/portal/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("placeOrder")}
          </Link>
        </Button>
      </PageHeader>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ship To</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Ship By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(
                (order: {
                  id: string;
                  orderNumber: string;
                  status: string;
                  shipToName: string;
                  shipToCity: string;
                  shipToState: string;
                  totalItems: number;
                  trackingNumber: string | null;
                  carrier: string | null;
                  orderDate: Date | string | null;
                  shipByDate: Date | string | null;
                }) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{order.shipToName}</div>
                      {(order.shipToCity || order.shipToState) && (
                        <div className="text-xs text-muted-foreground">
                          {[order.shipToCity, order.shipToState].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{order.totalItems}</TableCell>
                    <TableCell>
                      {order.trackingNumber ? (
                        <span className="font-mono text-xs">{order.trackingNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.orderDate ? format(new Date(order.orderDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {order.shipByDate ? format(new Date(order.shipByDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
