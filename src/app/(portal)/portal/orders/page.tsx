"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

type PortalOrder = {
  id: string;
  orderNumber: string;
  status: string;
  shipToName: string;
  shipToCity: string;
  shipToState: string;
  totalItems: number;
  trackingNumber: string | null;
  orderDate: Date;
  shipByDate: Date;
};

const mockOrders: PortalOrder[] = [
  {
    id: "1",
    orderNumber: "ORD-2026-0001",
    status: "shipped",
    shipToName: "Jane Cooper",
    shipToCity: "Austin",
    shipToState: "TX",
    totalItems: 3,
    trackingNumber: "1Z999AA10123456784",
    orderDate: new Date("2026-03-10"),
    shipByDate: new Date("2026-03-12"),
  },
  {
    id: "2",
    orderNumber: "ORD-2026-0005",
    status: "picking",
    shipToName: "Robert Fox",
    shipToCity: "Denver",
    shipToState: "CO",
    totalItems: 1,
    trackingNumber: null,
    orderDate: new Date("2026-03-15"),
    shipByDate: new Date("2026-03-16"),
  },
  {
    id: "3",
    orderNumber: "ORD-2026-0008",
    status: "awaiting_fulfillment",
    shipToName: "Acme Retail Store #12",
    shipToCity: "Phoenix",
    shipToState: "AZ",
    totalItems: 12,
    trackingNumber: null,
    orderDate: new Date("2026-03-15"),
    shipByDate: new Date("2026-03-18"),
  },
  {
    id: "4",
    orderNumber: "ORD-2026-0012",
    status: "delivered",
    shipToName: "Emily Wilson",
    shipToCity: "Seattle",
    shipToState: "WA",
    totalItems: 2,
    trackingNumber: "9400111899223100001234",
    orderDate: new Date("2026-03-08"),
    shipByDate: new Date("2026-03-10"),
  },
];

const columns: ColumnDef<PortalOrder>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    cell: ({ row }) => <span className="font-medium">{row.getValue("orderNumber")}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "shipToName",
    header: "Ship To",
    cell: ({ row }) => (
      <div>
        <div className="text-sm">{row.original.shipToName}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.shipToCity}, {row.original.shipToState}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "totalItems",
    header: "Items",
  },
  {
    accessorKey: "trackingNumber",
    header: "Tracking",
    cell: ({ row }) => {
      const tracking = row.getValue("trackingNumber") as string | null;
      return tracking ? (
        <span className="font-mono text-xs">{tracking}</span>
      ) : (
        <span className="text-muted-foreground">--</span>
      );
    },
  },
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) => format(row.getValue("orderDate") as Date, "MMM d, yyyy"),
  },
  {
    accessorKey: "shipByDate",
    header: "Ship By",
    cell: ({ row }) => format(row.getValue("shipByDate") as Date, "MMM d, yyyy"),
  },
];

export default function PortalOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description="View and manage your fulfillment orders">
        <Button asChild>
          <Link href="/portal/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Place Order
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockOrders}
        searchKey="orderNumber"
        searchPlaceholder="Search orders..."
      />
    </div>
  );
}
