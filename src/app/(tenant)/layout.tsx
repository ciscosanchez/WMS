import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getTenantFromHeaders } from "@/lib/tenant/context";
import { requireTenantAccess } from "@/lib/auth/session";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const slug = await getTenantFromHeaders();
  if (!slug) {
    const { redirect: nav } = await import("next/navigation");
    nav("/login");
    return null;
  }
  await requireTenantAccess(slug as string);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
