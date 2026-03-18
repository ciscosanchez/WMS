import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getTenants } from "@/modules/platform/actions";
import { TenantTable } from "./tenant-table";

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage all tenants on the platform">
        <Button asChild>
          <Link href="/platform/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Link>
        </Button>
      </PageHeader>

      <TenantTable tenants={tenants} />
    </div>
  );
}
