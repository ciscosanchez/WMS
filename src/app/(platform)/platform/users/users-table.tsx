"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  isSuperadmin: boolean;
  createdAt: string;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: string;
  }>;
};

const columns: ColumnDef<PlatformUser>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SortableHeader column={column} title="Email" />,
  },
  {
    id: "access",
    header: "Access",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {row.original.isSuperadmin && <Badge variant="outline">Platform Admin</Badge>}
        {row.original.tenants.length === 0 ? (
          <Badge variant="outline" className="text-muted-foreground">
            No tenant access
          </Badge>
        ) : (
          row.original.tenants.map((membership) => (
            <Badge key={`${row.original.id}-${membership.tenantId}`} variant="secondary">
              {membership.tenantName} · {membership.role}
            </Badge>
          ))
        )}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} title="Created" />,
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  },
];

export function PlatformUsersTable({ users }: { users: PlatformUser[] }) {
  return (
    <DataTable
      columns={columns}
      data={users}
      searchKey="email"
      searchPlaceholder="Search users..."
    />
  );
}
