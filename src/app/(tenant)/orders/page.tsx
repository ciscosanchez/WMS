import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const mockOrders = [
  {
    id: "1",
    orderNumber: "ORD-2026-0001",
    externalId: "#SH-4521",
    channel: "Shopify",
    clientCode: "ACME",
    status: "shipped",
    priority: "standard",
    shipToName: "Jane Cooper",
    shipToCity: "Austin",
    shipToState: "TX",
    totalItems: 3,
    orderDate: new Date("2026-03-10"),
    shipByDate: new Date("2026-03-12"),
  },
  {
    id: "2",
    orderNumber: "ORD-2026-0002",
    externalId: "#AMZ-9982",
    channel: "Amazon",
    clientCode: "ACME",
    status: "picking",
    priority: "expedited",
    shipToName: "Robert Fox",
    shipToCity: "Denver",
    shipToState: "CO",
    totalItems: 1,
    orderDate: new Date("2026-03-15"),
    shipByDate: new Date("2026-03-16"),
  },
  {
    id: "3",
    orderNumber: "ORD-2026-0003",
    externalId: null,
    channel: "Manual",
    clientCode: "GLOBEX",
    status: "awaiting_fulfillment",
    priority: "standard",
    shipToName: "Acme Retail Store #12",
    shipToCity: "Phoenix",
    shipToState: "AZ",
    totalItems: 12,
    orderDate: new Date("2026-03-15"),
    shipByDate: new Date("2026-03-18"),
  },
  {
    id: "4",
    orderNumber: "ORD-2026-0004",
    externalId: "#SH-4530",
    channel: "Shopify",
    clientCode: "STARK",
    status: "awaiting_fulfillment",
    priority: "rush",
    shipToName: "Emily Wilson",
    shipToCity: "Seattle",
    shipToState: "WA",
    totalItems: 2,
    orderDate: new Date("2026-03-16"),
    shipByDate: new Date("2026-03-16"),
  },
  {
    id: "5",
    orderNumber: "ORD-2026-0005",
    externalId: "#WM-1122",
    channel: "Walmart",
    clientCode: "ACME",
    status: "pending",
    priority: "standard",
    shipToName: "Michael Brown",
    shipToCity: "Portland",
    shipToState: "OR",
    totalItems: 5,
    orderDate: new Date("2026-03-16"),
    shipByDate: new Date("2026-03-19"),
  },
  {
    id: "6",
    orderNumber: "ORD-2026-0006",
    externalId: null,
    channel: "API",
    clientCode: "INITECH",
    status: "packed",
    priority: "standard",
    shipToName: "Warehouse Direct LLC",
    shipToCity: "Dallas",
    shipToState: "TX",
    totalItems: 8,
    orderDate: new Date("2026-03-16"),
    shipByDate: new Date("2026-03-18"),
  },
];

const priorityColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-700",
  expedited: "bg-blue-100 text-blue-700",
  rush: "bg-orange-100 text-orange-700",
  same_day: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
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
            {mockOrders.map((order) => (
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
                      <span className="ml-2 text-xs text-muted-foreground">{order.externalId}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{order.channel}</Badge>
                </TableCell>
                <TableCell>{order.clientCode}</TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{order.shipToName}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.shipToCity}, {order.shipToState}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{order.totalItems}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={priorityColors[order.priority]}>
                    {order.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>{format(order.shipByDate, "MMM d")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
