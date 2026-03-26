import { requirePermission } from "@/lib/auth/session";
import { getTenantFromHeaders } from "@/lib/tenant/context";
import { OfflineProvider } from "@/providers/offline-provider";
import OperatorNav from "./operator-nav";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const slug = await getTenantFromHeaders();
  if (!slug) {
    const { redirect: nav } = await import("next/navigation");
    nav("/login");
    return null;
  }
  const { user } = await requirePermission(slug as string, "operator:write");
  return (
    <OfflineProvider>
      <OperatorNav userName={user.name}>{children}</OperatorNav>
    </OfflineProvider>
  );
}
