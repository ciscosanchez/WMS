"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Ban, Trash2 } from "lucide-react";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  schema: string;
  status: "active" | "suspended" | "provisioning";
  plan: "starter" | "professional" | "enterprise";
  users: number;
  createdAt: string;
}

const planColors: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-gray-200",
  professional: "bg-purple-100 text-purple-700 border-purple-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

const mockTenants: Tenant[] = [
  {
    id: "1",
    name: "Armstrong Logistics",
    slug: "armstrong-logistics",
    schema: "tenant_armstrong_logistics",
    status: "active",
    plan: "professional",
    users: 8,
    createdAt: "2026-01-15",
  },
  {
    id: "2",
    name: "Demo Warehouse",
    slug: "demo-warehouse",
    schema: "tenant_demo_warehouse",
    status: "active",
    plan: "starter",
    users: 4,
    createdAt: "2026-03-13",
  },
];

const columns: ColumnDef<Tenant>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {row.original.slug}
      </code>
    ),
  },
  {
    accessorKey: "schema",
    header: "Schema",
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {row.original.schema}
      </code>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const plan = row.original.plan;
      const label = plan.charAt(0).toUpperCase() + plan.slice(1);
      const colorClass =
        planColors[plan] ?? "bg-gray-100 text-gray-700 border-gray-200";
      return (
        <Badge variant="outline" className={`font-medium ${colorClass}`}>
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "users",
    header: ({ column }) => <SortableHeader column={column} title="Users" />,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} title="Created" />,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const tenant = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                alert(`View tenant: ${tenant.name} (not yet implemented)`)
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                alert(`Suspend tenant: ${tenant.name} (not yet implemented)`)
              }
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                alert(`Delete tenant: ${tenant.name} (not yet implemented)`)
              }
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

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage all tenants on the platform"
      >
        <Button asChild>
          <Link href="/platform/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockTenants}
        searchKey="name"
        searchPlaceholder="Search tenants..."
      />
    </div>
  );
}
