"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteClient } from "@/modules/clients/actions";

interface Client {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
}

const columns: ColumnDef<Client>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => <SortableHeader column={column} title="Code" />,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
  },
  {
    accessorKey: "contactName",
    header: "Contact",
  },
  {
    accessorKey: "contactEmail",
    header: "Email",
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => {
      const city = row.original.city;
      const state = row.original.state;
      return [city, state].filter(Boolean).join(", ") || "-";
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.isActive ? "active" : "suspended"} />,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const client = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/clients/${client.id}/edit`} />}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm("Delete this client?")) {
                  deleteClient(client.id);
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

export function ClientsTable({ data }: { data: Client[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search clients..."
    />
  );
}
