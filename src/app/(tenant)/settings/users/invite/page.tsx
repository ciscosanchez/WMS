import { requireTenantContext } from "@/lib/tenant/context";
import { InviteUserClient } from "./invite-client";

export default async function InviteUserPage() {
  const { tenant } = await requireTenantContext("users:write");

  const clients = await tenant.db.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return <InviteUserClient clients={clients} />;
}
