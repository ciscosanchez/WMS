"use client";

import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
} from "lucide-react";

const recentActivity = [
  {
    id: "1",
    event: "Tenant Created",
    detail: "Armstrong Logistics provisioned",
    tenant: "Armstrong Logistics",
    timestamp: "2026-03-15 14:32",
  },
  {
    id: "2",
    event: "User Invited",
    detail: "sarah@armstrong.io invited to Armstrong Logistics",
    tenant: "Armstrong Logistics",
    timestamp: "2026-03-15 11:18",
  },
  {
    id: "3",
    event: "Plan Upgraded",
    detail: "Armstrong Logistics upgraded to Professional",
    tenant: "Armstrong Logistics",
    timestamp: "2026-03-14 09:45",
  },
  {
    id: "4",
    event: "Tenant Created",
    detail: "Demo Warehouse provisioned",
    tenant: "Demo Warehouse",
    timestamp: "2026-03-13 16:20",
  },
  {
    id: "5",
    event: "User Invited",
    detail: "demo@ramola.io invited to Demo Warehouse",
    tenant: "Demo Warehouse",
    timestamp: "2026-03-13 16:22",
  },
  {
    id: "6",
    event: "Schema Migration",
    detail: "v2.1.0 migration applied to all tenants",
    tenant: "All",
    timestamp: "2026-03-12 08:00",
  },
];

const eventColors: Record<string, string> = {
  "Tenant Created": "bg-green-100 text-green-700 border-green-200",
  "User Invited": "bg-blue-100 text-blue-700 border-blue-200",
  "Plan Upgraded": "bg-purple-100 text-purple-700 border-purple-200",
  "Schema Migration": "bg-orange-100 text-orange-700 border-orange-200",
};

export default function PlatformDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of all tenants and platform metrics"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total Tenants"
          value={2}
          description="+1 this month"
          icon={Building2}
        />
        <KpiCard
          title="Active Users"
          value={12}
          description="Across all tenants"
          icon={Users}
        />
        <KpiCard
          title="Total SKUs"
          value={47}
          description="Across all tenants"
          icon={Package}
        />
        <KpiCard
          title="Total Orders"
          value={268}
          description="+34 this week"
          icon={ShoppingCart}
        />
        <KpiCard
          title="MRR"
          value="$4,200"
          description="+$1,200 from upgrades"
          icon={DollarSign}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Platform Activity</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-medium ${eventColors[activity.event] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
                    >
                      {activity.event}
                    </Badge>
                  </TableCell>
                  <TableCell>{activity.detail}</TableCell>
                  <TableCell className="font-medium">
                    {activity.tenant}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {activity.timestamp}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
