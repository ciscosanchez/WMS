"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus } from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "warehouse_worker" | "viewer";
  status: "active" | "invited";
  joinedAt: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_worker: "bg-orange-100 text-orange-700 border-orange-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
};

const mockUsers: User[] = [
  {
    id: "1",
    name: "Cisco Sanchez",
    email: "cisco@armstrong.io",
    role: "admin",
    status: "active",
    joinedAt: "2025-01-15",
  },
  {
    id: "2",
    name: "Carlos Martinez",
    email: "carlos@armstrong.io",
    role: "warehouse_worker",
    status: "active",
    joinedAt: "2025-03-10",
  },
  {
    id: "3",
    name: "Maria Lopez",
    email: "maria@armstrong.io",
    role: "manager",
    status: "active",
    joinedAt: "2025-06-01",
  },
  {
    id: "4",
    name: "Sarah Chen",
    email: "sarah@armstrong.io",
    role: "viewer",
    status: "invited",
    joinedAt: "2026-03-12",
  },
];

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SortableHeader column={column} title="Email" />,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.original.role;
      const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const colorClass = roleColors[role] ?? "bg-gray-100 text-gray-700 border-gray-200";
      return (
        <Badge variant="outline" className={`font-medium ${colorClass}`}>
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "joinedAt",
    header: ({ column }) => <SortableHeader column={column} title="Joined" />,
    cell: ({ row }) => {
      const date = new Date(row.original.joinedAt);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
];

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage team members and their access levels">
        <Button asChild>
          <Link href="/settings/users/invite">
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockUsers}
        searchKey="name"
        searchPlaceholder="Search users..."
      />
    </div>
  );
}
