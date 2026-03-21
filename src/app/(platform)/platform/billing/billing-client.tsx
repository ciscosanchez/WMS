"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, CreditCard, BarChart3 } from "lucide-react";

interface BillingTenant {
  id: string;
  name: string;
  plan: string;
  monthlyFee: number;
  status: string;
  createdAt: string;
}

interface BillingData {
  tenants: BillingTenant[];
  mrr: number;
  arr: number;
  activeCount: number;
  avgRevenue: number;
}

const planColors: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-gray-200",
  professional: "bg-purple-100 text-purple-700 border-purple-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

const columns: ColumnDef<BillingTenant>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Tenant" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const plan = row.original.plan;
      const label = plan.charAt(0).toUpperCase() + plan.slice(1);
      const colorClass = planColors[plan] ?? "bg-gray-100 text-gray-700 border-gray-200";
      return (
        <Badge variant="outline" className={`font-medium ${colorClass}`}>
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "monthlyFee",
    header: ({ column }) => <SortableHeader column={column} title="Monthly Fee" />,
    cell: ({ row }) => `$${row.original.monthlyFee.toLocaleString()}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
];

export function BillingClient({ data }: { data: BillingData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Revenue and subscription management across all tenants"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="MRR"
          value={`$${data.mrr.toLocaleString()}`}
          description="Monthly Recurring Revenue"
          icon={DollarSign}
        />
        <KpiCard
          title="ARR"
          value={`$${data.arr.toLocaleString()}`}
          description="Annual Recurring Revenue"
          icon={TrendingUp}
        />
        <KpiCard
          title="Active Subscriptions"
          value={data.activeCount}
          description="All current"
          icon={CreditCard}
        />
        <KpiCard
          title="Avg Revenue / Tenant"
          value={`$${data.avgRevenue.toLocaleString()}`}
          description="Per month"
          icon={BarChart3}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tenant Subscriptions</h2>
        <DataTable
          columns={columns}
          data={data.tenants}
          searchKey="name"
          searchPlaceholder="Search tenants..."
        />
      </div>
    </div>
  );
}
