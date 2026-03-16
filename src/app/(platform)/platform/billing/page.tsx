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
  plan: "starter" | "professional" | "enterprise";
  monthlyFee: number;
  status: "active" | "past_due" | "cancelled";
  nextBillingDate: string;
}

const planColors: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-gray-200",
  professional: "bg-purple-100 text-purple-700 border-purple-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

const billingStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  past_due: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
};

const mockBillingTenants: BillingTenant[] = [
  {
    id: "1",
    name: "Armstrong Logistics",
    plan: "professional",
    monthlyFee: 299,
    status: "active",
    nextBillingDate: "2026-04-15",
  },
  {
    id: "2",
    name: "Demo Warehouse",
    plan: "starter",
    monthlyFee: 99,
    status: "active",
    nextBillingDate: "2026-04-13",
  },
];

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
    cell: ({ row }) => {
      const fee = row.original.monthlyFee;
      return `$${fee.toLocaleString()}`;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "nextBillingDate",
    header: ({ column }) => <SortableHeader column={column} title="Next Billing" />,
    cell: ({ row }) => {
      const date = new Date(row.original.nextBillingDate);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Revenue and subscription management across all tenants"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="MRR"
          value="$4,200"
          description="Monthly Recurring Revenue"
          icon={DollarSign}
        />
        <KpiCard
          title="ARR"
          value="$50,400"
          description="Annual Recurring Revenue"
          icon={TrendingUp}
        />
        <KpiCard
          title="Active Subscriptions"
          value={2}
          description="All current"
          icon={CreditCard}
        />
        <KpiCard
          title="Avg Revenue / Tenant"
          value="$2,100"
          description="Per month"
          icon={BarChart3}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tenant Subscriptions</h2>
        <DataTable
          columns={columns}
          data={mockBillingTenants}
          searchKey="name"
          searchPlaceholder="Search tenants..."
        />
      </div>
    </div>
  );
}
