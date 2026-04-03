import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MatrixEasterEgg } from "@/components/shared/matrix-easter-egg";
import { getTenantFromHeaders } from "@/lib/tenant/context";
import { requireTenantAccess } from "@/lib/auth/session";
import { publicDb } from "@/lib/db/public-client";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const slug = await getTenantFromHeaders();
  if (!slug) {
    const { redirect: nav } = await import("next/navigation");
    nav("/login");
    return null;
  }
  await requireTenantAccess(slug as string);

  // Load tenant brand colors
  const tenant = await publicDb.tenant.findUnique({ where: { slug: slug as string } });
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const brandStyle: Record<string, string> = {};
  if (settings.brandSidebarBg) {
    brandStyle["--sidebar"] = settings.brandSidebarBg as string;
    brandStyle["--sidebar-accent"] = settings.brandSidebarBg as string;
  }
  if (settings.brandSidebarText) {
    brandStyle["--sidebar-foreground"] = settings.brandSidebarText as string;
    brandStyle["--sidebar-accent-foreground"] = settings.brandSidebarText as string;
    brandStyle["--sidebar-primary-foreground"] = settings.brandSidebarText as string;
  }
  if (settings.brandPrimary) {
    brandStyle["--sidebar-primary"] = settings.brandPrimary as string;
  }

  return (
    <SidebarProvider>
      <div style={Object.keys(brandStyle).length > 0 ? brandStyle as React.CSSProperties : undefined}>
        <AppSidebar />
      </div>
      <SidebarInset>
        <Topbar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
      <MatrixEasterEgg />
    </SidebarProvider>
  );
}
