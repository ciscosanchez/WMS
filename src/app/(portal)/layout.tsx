import { requirePortalContext } from "@/lib/tenant/context";
import { redirect } from "next/navigation";
import PortalNav from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  try {
    const { user, tenant, portalClientId } = await requirePortalContext();
    const portalClient = portalClientId
      ? await tenant.db.client.findUnique({
          where: { id: portalClientId },
          select: { name: true, code: true },
        })
      : null;

    return (
      <PortalNav
        accountName={portalClient?.name ?? "Portal Account"}
        accountCode={portalClient?.code ?? null}
        userName={user.name}
      >
        {children}
      </PortalNav>
    );
  } catch {
    redirect("/dashboard");
  }
}
