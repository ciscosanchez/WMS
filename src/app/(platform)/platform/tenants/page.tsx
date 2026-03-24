import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getTenants } from "@/modules/platform/actions";
import { TenantTable } from "./tenant-table";
import { getTranslations } from "next-intl/server";

export default async function TenantsPage() {
  const t = await getTranslations("platform.tenants");
  const tenants = await getTenants();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/platform/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("addTenant")}
          </Link>
        </Button>
      </PageHeader>

      <TenantTable tenants={tenants} />
    </div>
  );
}
