import { requireTenantContext } from "@/lib/tenant/context";
import PortalNav from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Require both authentication AND tenant membership (not just auth)
  await requireTenantContext();
  return <PortalNav>{children}</PortalNav>;
}
