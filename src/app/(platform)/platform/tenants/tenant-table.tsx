"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Ban, RefreshCw, CreditCard, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  deleteTenant,
  reactivateTenant,
  suspendTenant,
  updateTenantPlan,
} from "@/modules/platform/actions";

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

const tenantPlans = ["starter", "professional", "enterprise"] as const;

function TenantActions({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [pending, setPending] = useState<"suspend" | "reactivate" | "plan" | "delete" | null>(
    null
  );
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(tenant.plan);

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

  async function handlePlanSave() {
    if (selectedPlan === tenant.plan) {
      setPlanDialogOpen(false);
      return;
    }

    setPending("plan");
    const result = await updateTenantPlan(tenant.id, selectedPlan);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Plan updated to ${selectedPlan}`);
      setPlanDialogOpen(false);
      router.refresh();
    }
    setPending(null);
  }

  async function handleDelete() {
    const confirmation = window.prompt(
      `Type "${tenant.slug}" to permanently delete this tenant and drop its schema.`
    );

    if (confirmation !== tenant.slug) {
      if (confirmation !== null) {
        toast.error("Delete cancelled. Tenant slug did not match.");
      }
      return;
    }

    setPending("delete");
    const result = await deleteTenant(tenant.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Tenant deleted");
      router.refresh();
    }
    setPending(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending !== null}
            onClick={() => {
              setSelectedPlan(tenant.plan);
              setPlanDialogOpen(true);
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Change plan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tenant.status === "active" ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending !== null}
              onClick={() => void handleSuspend()}
            >
              <Ban className="mr-2 h-4 w-4" />
              {pending === "suspend" ? "Suspending..." : "Suspend"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending !== null} onClick={() => void handleReactivate()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {pending === "reactivate" ? "Reactivating..." : "Reactivate"}
            </DropdownMenuItem>
          )}
          {tenant.status !== "active" ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending !== null}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {pending === "delete" ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change tenant plan</DialogTitle>
            <DialogDescription>
              Update the subscription plan for {tenant.name}. Billing and plan badges will refresh
              after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`tenant-plan-${tenant.id}`}>
              Plan
            </label>
            <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value ?? tenant.plan)}>
              <SelectTrigger id={`tenant-plan-${tenant.id}`} className="w-full">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent align="start">
                {tenantPlans.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)} disabled={pending !== null}>
              Cancel
            </Button>
            <Button onClick={() => void handlePlanSave()} disabled={pending !== null}>
              {pending === "plan" ? "Saving..." : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    cell: ({ row }) => (
      <Link
        href={`/platform/users?tenant=${encodeURIComponent(row.original.slug)}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.original.userCount}
      </Link>
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
