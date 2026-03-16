"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ServerDataTable } from "@/components/data-table/server-data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { format } from "date-fns";

interface TransactionRow {
  id: string;
  type: string;
  product: { sku: string } | string;
  fromBin: { barcode: string } | null;
  toBin: { barcode: string } | null;
  quantity: number;
  lotNumber: string | null;
  referenceType: string | null;
  performedAt: string | Date;
}

const columns: ColumnDef<TransactionRow>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <StatusBadge status={row.original.type} />,
  },
  {
    id: "product",
    header: "Product",
    cell: ({ row }) => {
      const p = row.original.product;
      return <span className="font-medium">{typeof p === "string" ? p : p?.sku}</span>;
    },
  },
  {
    id: "from",
    header: "From",
    cell: ({ row }) => row.original.fromBin?.barcode || "-",
  },
  {
    id: "to",
    header: "To",
    cell: ({ row }) => row.original.toBin?.barcode || "-",
  },
  {
    accessorKey: "quantity",
    header: "Qty",
    cell: ({ row }) => <span className="text-right tabular-nums">{row.original.quantity}</span>,
  },
  {
    accessorKey: "lotNumber",
    header: "Lot",
    cell: ({ row }) => row.original.lotNumber || "-",
  },
  {
    accessorKey: "referenceType",
    header: "Reference",
    cell: ({ row }) => <span className="text-xs">{row.original.referenceType || "-"}</span>,
  },
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.performedAt), "MMM d, HH:mm"),
  },
];

interface MovementsTableProps {
  data: TransactionRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchValue?: string;
}

export function MovementsTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  searchValue,
}: MovementsTableProps) {
  return (
    <ServerDataTable
      columns={columns}
      data={data}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      searchValue={searchValue}
      searchPlaceholder="Search by SKU or reference..."
    />
  );
}
