"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  checkBackorderFulfillment,
  retryBackorderAllocation,
} from "@/modules/orders/backorder-actions";

interface BackorderedOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  shipToName: string;
  createdAt: Date;
  lines: Array<{
    id: string;
    productId: string;
    quantity: number;
    product: { sku: string; name: string };
  }>;
  picks: Array<{
    id: string;
    lines: Array<{ productId: string; quantity: number }>;
  }>;
}

function ActionsCell({ order }: { order: BackorderedOrder }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCheckFulfillment() {
    setLoading(true);
    try {
      const result = await checkBackorderFulfillment(order.id);
      if (result.canFulfillAll) {
        toast.success(`${result.orderNumber}: All lines can be fulfilled`);
      } else if (result.canFulfillSome) {
        toast.info(`${result.orderNumber}: Some lines can be fulfilled`);
      } else {
        toast.warning(`${result.orderNumber}: No lines can be fulfilled yet`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check fulfillment");
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryAllocation() {
    setLoading(true);
    try {
      const result = await retryBackorderAllocation(order.id);
      if (result.status === "picking") {
        toast.success("All lines allocated — order moved to picking");
      } else {
        toast.info(
          `Allocated ${result.newlyAllocated} lines, ${result.stillBackordered} still backordered`
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry allocation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={loading} onClick={handleCheckFulfillment}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Check Fulfillment
        </DropdownMenuItem>
        <DropdownMenuItem disabled={loading} onClick={handleRetryAllocation}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry Allocation
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={loading}
          onClick={() => {
            toast.info("Cancel not yet implemented");
          }}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<BackorderedOrder>[] = [
  {
    accessorKey: "orderNumber",
    header: ({ column }) => <SortableHeader column={column} title="Order #" />,
    cell: ({ row }) => <span className="font-medium font-mono">{row.original.orderNumber}</span>,
  },
  {
    accessorKey: "shipToName",
    header: ({ column }) => <SortableHeader column={column} title="Client" />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "lines",
    header: "Lines",
    cell: ({ row }) => <Badge variant="outline">{row.original.lines.length} items</Badge>,
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell order={row.original} />,
  },
];

export function BackordersTable({ data }: { data: BackorderedOrder[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="orderNumber"
      searchPlaceholder="Search backorders..."
    />
  );
}
