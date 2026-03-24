import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Building2, Users } from "lucide-react";
import { getPlatformStats } from "@/modules/platform/actions";
import { getTranslations } from "next-intl/server";

export default async function PlatformDashboardPage() {
  const t = await getTranslations("platform.dashboard");
  const stats = await getPlatformStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("activeTenants")}
          value={stats.tenantCount}
          description={t("activeTenantsDesc")}
          icon={Building2}
        />
        <KpiCard
          title={t("totalUsers")}
          value={stats.userCount}
          description={t("totalUsersDesc")}
          icon={Users}
        />
      </div>
    </div>
  );
}
