"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  carrier: string | null;
  expectedDate: string | Date | null;
  createdAt: string | Date;
  client: { code: string; name: string };
  _count: { lines: number; transactions: number; discrepancies: number };
}

const columns: ColumnDef<Shipment>[] = [
  {
    accessorKey: "shipmentNumber",
    header: ({ column }) => <SortableHeader column={column} title="ASN #" />,
    cell: ({ row }) => (
      <Link
        href={`/receiving/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.shipmentNumber}
      </Link>
    ),
  },
  {
    id: "client",
    header: "Client",
    cell: ({ row }) => row.original.client.code,
  },
  {
    accessorKey: "carrier",
    header: "Carrier",
    cell: ({ row }) => row.original.carrier || "-",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "lines",
    header: "Lines",
    cell: ({ row }) => row.original._count.lines,
  },
  {
    accessorKey: "expectedDate",
    header: "Expected",
    cell: ({ row }) =>
      row.original.expectedDate ? format(new Date(row.original.expectedDate), "MMM d, yyyy") : "-",
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} title="Created" />,
    cell: ({ row }) => format(new Date(row.original.createdAt), "MMM d, yyyy"),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/receiving/${row.original.id}`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
    ),
  },
];

export function ShipmentsTable({ data }: { data: Shipment[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="shipmentNumber"
      searchPlaceholder="Search shipments..."
    />
  );
}
