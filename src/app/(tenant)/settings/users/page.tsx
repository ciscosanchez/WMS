import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { requireTenantContext } from "@/lib/tenant/context";
import { getTenantUsers } from "@/modules/users/actions";
import { getTenantRbacGovernance } from "@/modules/users/actions";
import { getUserPersonas } from "@/lib/auth/personas";
import { getAccessRisks, normalizePermissionOverrides } from "@/lib/auth/rbac";
import { AccessReview } from "./access-review";
import { UserTable } from "./user-table";

export default async function UsersPage() {
  const { tenant } = await requireTenantContext("users:read");
  const members = await getTenantUsers(tenant.tenantId);
  const governance = await getTenantRbacGovernance();
  const clients = await tenant.db.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const users = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    personas: getUserPersonas({
      isSuperadmin: m.user.isSuperadmin,
      tenants: [{ slug: tenant.slug, role: m.role, portalClientId: m.portalClientId }],
    }, tenant.slug),
    portalClientId: m.portalClientId,
    portalClientName: m.portalClientId ? clientMap.get(m.portalClientId)?.name ?? null : null,
    portalClientCode: m.portalClientId ? clientMap.get(m.portalClientId)?.code ?? null : null,
    permissionOverrides: normalizePermissionOverrides(m.permissionOverrides),
    risks: getAccessRisks({
      role: m.role,
      portalClientId: m.portalClientId,
      overrides: m.permissionOverrides,
    }),
    joinedAt: m.user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage team members and their access levels">
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/api/export/access-review">
              <Download className="mr-2 h-4 w-4" />
              Export Access Review
            </Link>
          </Button>
          <Button asChild>
            <Link href="/settings/users/invite">
              <Plus className="mr-2 h-4 w-4" />
              Invite User
            </Link>
          </Button>
        </div>
      </PageHeader>

      <AccessReview
        users={users}
      />

      <UserTable
        users={users}
        clients={clients}
        savedPresets={governance.savedPresets}
        reviewCadenceDays={governance.reviewCadenceDays}
        lastReviewCompletedAt={governance.lastReviewCompletedAt ?? null}
        nextReviewDueAt={governance.nextReviewDueAt ?? null}
      />
    </div>
  );
}
