"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
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
import { MoreHorizontal, Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { suspendTenant, reactivateTenant } from "@/modules/platform/actions";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  dbSchema: string;
  status: string;
  plan: string;
  userCount: number;
  createdAt: string;
};

const planColors: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-gray-200",
  professional: "bg-purple-100 text-purple-700 border-purple-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

function TenantActions({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [pending, setPending] = useState<"suspend" | "reactivate" | null>(null);

  async function handleSuspend() {
    if (!confirm(`Suspend "${tenant.name}"? They will lose access immediately.`)) return;
    setPending("suspend");
    const result = await suspendTenant(tenant.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Tenant suspended");
      router.refresh();
    }
    setPending(null);
  }

  async function handleReactivate() {
    setPending("reactivate");
    const result = await reactivateTenant(tenant.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Tenant reactivated");
      router.refresh();
    }
    setPending(null);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {tenant.status === "active" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending !== null}
              onClick={() => void handleSuspend()}
            >
              <Ban className="mr-2 h-4 w-4" />
              {pending === "suspend" ? "Suspending..." : "Suspend"}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled={pending !== null} onClick={() => void handleReactivate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {pending === "reactivate" ? "Reactivating..." : "Reactivate"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<Tenant>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.slug}</code>
    ),
  },
  {
    accessorKey: "dbSchema",
    header: "Schema",
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.dbSchema}</code>
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
      return (
        <Badge variant="outline" className={`font-medium ${planColors[plan] ?? ""}`}>
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "userCount",
    header: ({ column }) => <SortableHeader column={column} title="Users" />,
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
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <TenantActions tenant={row.original} />,
  },
];

export function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <DataTable
      columns={columns}
      data={tenants}
      searchKey="name"
      searchPlaceholder="Search tenants..."
    />
  );
}
