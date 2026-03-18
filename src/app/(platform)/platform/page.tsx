import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Building2, Users } from "lucide-react";
import { getPlatformStats } from "@/modules/platform/actions";

export default async function PlatformDashboardPage() {
  const stats = await getPlatformStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of all tenants and platform metrics"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Active Tenants"
          value={stats.tenantCount}
          description="Provisioned and active"
          icon={Building2}
        />
        <KpiCard
          title="Total Users"
          value={stats.userCount}
          description="Across all tenants"
          icon={Users}
        />
      </div>
    </div>
  );
}
