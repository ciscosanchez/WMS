import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { getOrders } from "@/modules/orders/actions";

const priorityColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-700",
  expedited: "bg-blue-100 text-blue-700",
  rush: "bg-orange-100 text-orange-700",
  same_day: "bg-red-100 text-red-700",
};

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Manage fulfillment orders from all channels">
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Create your first fulfillment order to get started."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Ship To</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ship By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {orders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.externalId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {order.externalId}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {order.channel?.name ?? order.channel ?? "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.client?.code ?? order.clientCode ?? "-"}</TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{order.shipToName}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.shipToCity}, {order.shipToState ?? ""}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order._count?.lines ?? order.lines?.length ?? order.totalItems ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[order.priority] ?? ""}>
                      {order.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    {order.shipByDate ? format(new Date(order.shipByDate), "MMM d") : "-"}
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
