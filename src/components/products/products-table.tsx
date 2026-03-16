"use client";

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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteProduct } from "@/modules/products/actions";

interface Product {
  id: string;
  sku: string;
  name: string;
  baseUom: string;
  trackLot: boolean;
  trackSerial: boolean;
  isActive: boolean;
  client: { code: string; name: string };
}

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "sku",
    header: ({ column }) => <SortableHeader column={column} title="SKU" />,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
  },
  {
    id: "client",
    header: "Client",
    cell: ({ row }) => row.original.client.code,
  },
  {
    accessorKey: "baseUom",
    header: "UOM",
  },
  {
    id: "tracking",
    header: "Tracking",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.trackLot && <Badge variant="outline">Lot</Badge>}
        {row.original.trackSerial && <Badge variant="outline">Serial</Badge>}
        {!row.original.trackLot && !row.original.trackSerial && "-"}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.isActive ? "active" : "suspended"} />,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/products/${product.id}/edit`} />}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm("Delete this product?")) {
                  deleteProduct(product.id);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ProductsTable({ data }: { data: Product[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="sku"
      searchPlaceholder="Search products..."
    />
  );
}
