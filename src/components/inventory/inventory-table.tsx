"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";

interface InventoryRow {
  id: string;
  onHand: number;
  allocated: number;
  available: number;
  lotNumber: string | null;
  serialNumber: string | null;
  uom: string;
  product: {
    sku: string;
    name: string;
    client: { code: string };
  };
  bin: {
    barcode: string;
    shelf: {
      rack: {
        aisle: {
          zone: {
            code: string;
            warehouse: { code: string };
          };
        };
      };
    };
  };
}

const columns: ColumnDef<InventoryRow>[] = [
  {
    id: "sku",
    header: ({ column }) => <SortableHeader column={column} title="SKU" />,
    accessorFn: (row) => row.product.sku,
  },
  {
    id: "productName",
    header: "Product",
    accessorFn: (row) => row.product.name,
  },
  {
    id: "client",
    header: "Client",
    accessorFn: (row) => row.product.client.code,
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => row.original.bin.barcode,
  },
  {
    accessorKey: "lotNumber",
    header: "Lot",
    cell: ({ row }) => row.original.lotNumber || "-",
  },
  {
    accessorKey: "onHand",
    header: ({ column }) => <SortableHeader column={column} title="On Hand" />,
    cell: ({ row }) => <span className="font-medium">{row.original.onHand}</span>,
  },
  {
    accessorKey: "allocated",
    header: "Allocated",
  },
  {
    accessorKey: "available",
    header: ({ column }) => <SortableHeader column={column} title="Available" />,
    cell: ({ row }) => {
      const avail = row.original.available;
      return <Badge variant={avail > 0 ? "default" : "destructive"}>{avail}</Badge>;
    },
  },
  {
    accessorKey: "uom",
    header: "UOM",
  },
];

export function InventoryTable({ data }: { data: InventoryRow[] }) {
  return (
    <DataTable columns={columns} data={data} searchKey="sku" searchPlaceholder="Search by SKU..." />
  );
}
