import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireTenantContext } from "@/lib/tenant/context";
import { getTenantUsers } from "@/modules/users/actions";
import { getUserPersonas } from "@/lib/auth/personas";
import { UserTable } from "./user-table";

export default async function UsersPage() {
  const { tenant } = await requireTenantContext("users:read");
  const members = await getTenantUsers(tenant.tenantId);
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
    joinedAt: m.user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage team members and their access levels">
        <Button asChild>
          <Link href="/settings/users/invite">
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Link>
        </Button>
      </PageHeader>

      <UserTable users={users} clients={clients} />
    </div>
  );
}
