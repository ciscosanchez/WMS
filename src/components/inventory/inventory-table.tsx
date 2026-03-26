"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ServerDataTable } from "@/components/data-table/server-data-table";
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
  operationalAttributes?: Array<{ key: string; label: string; value: string }>;
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
    id: "operationalAttributes",
    header: "Attributes",
    cell: ({ row }) => {
      const attributes = row.original.operationalAttributes ?? [];
      if (attributes.length === 0) return <span className="text-muted-foreground">-</span>;

      return (
        <div className="flex flex-wrap gap-1">
          {attributes.slice(0, 3).map((attribute) => (
            <Badge key={attribute.key} variant="outline" className="text-xs">
              {attribute.label}: {attribute.value}
            </Badge>
          ))}
          {attributes.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{attributes.length - 3}
            </Badge>
          )}
        </div>
      );
    },
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

interface InventoryTableProps {
  data: InventoryRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchValue?: string;
}

export function InventoryTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  searchValue,
}: InventoryTableProps) {
  return (
    <ServerDataTable
      columns={columns}
      data={data}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      searchValue={searchValue}
      searchPlaceholder="Search by SKU or product name..."
    />
  );
}
