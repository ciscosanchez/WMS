"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  PackageOpen,
  AlertTriangle,
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  ListChecks,
  MapPin,
  Users,
  Package,
  BarChart3,
  Settings,
  Warehouse,
  ShoppingCart,
  ScanLine,
  Truck,
  Store,
  ArrowDownToLine,
  Smartphone,
} from "lucide-react";

type NavItem = { titleKey: string; href: string; icon: typeof LayoutDashboard };
type NavGroup = { labelKey: string; items: NavItem[] };

const navigation: NavGroup[] = [
  {
    labelKey: "overview",
    items: [
      { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { titleKey: "operations", href: "/operations", icon: Users },
    ],
  },
  {
    labelKey: "inbound",
    items: [
      { titleKey: "inboundShipments", href: "/receiving", icon: PackageOpen },
      { titleKey: "discrepancies", href: "/receiving/discrepancies", icon: AlertTriangle },
    ],
  },
  {
    labelKey: "fulfillment",
    items: [
      { titleKey: "orders", href: "/orders", icon: ShoppingCart },
      { titleKey: "picking", href: "/picking", icon: ScanLine },
      { titleKey: "shipping", href: "/shipping", icon: Truck },
    ],
  },
  {
    labelKey: "inventory",
    items: [
      { titleKey: "stockBrowser", href: "/inventory", icon: Boxes },
      { titleKey: "putaway", href: "/inventory/putaway", icon: ArrowDownToLine },
      { titleKey: "movements", href: "/inventory/movements", icon: ArrowLeftRight },
      { titleKey: "adjustments", href: "/inventory/adjustments", icon: ClipboardCheck },
      { titleKey: "cycleCounts", href: "/inventory/cycle-counts", icon: ListChecks },
    ],
  },
  {
    labelKey: "setup",
    items: [
      { titleKey: "locations", href: "/warehouse", icon: MapPin },
      { titleKey: "clients", href: "/clients", icon: Users },
      { titleKey: "products", href: "/products", icon: Package },
      { titleKey: "channels", href: "/channels", icon: Store },
    ],
  },
  {
    labelKey: "system",
    items: [
      { titleKey: "reports", href: "/reports", icon: BarChart3 },
      { titleKey: "settings", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Ramola</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/receive" />}>
              <Smartphone className="h-4 w-4" />
              <span>{t("floorApp")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
