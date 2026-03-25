import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPlatformUsers } from "@/modules/platform/actions";
import { PlatformUsersTable } from "./users-table";

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const tenantSlug = params.tenant?.trim() || undefined;
  const users = await getPlatformUsers(tenantSlug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          tenantSlug
            ? `Platform and tenant users filtered to ${tenantSlug}.`
            : "Platform and tenant users across all tenants."
        }
      >
        {tenantSlug ? (
          <Button asChild variant="outline">
            <Link href="/platform/users">Clear filter</Link>
          </Button>
        ) : null}
      </PageHeader>

      <PlatformUsersTable users={users} />
    </div>
  );
}
