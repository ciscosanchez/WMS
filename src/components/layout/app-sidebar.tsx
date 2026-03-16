"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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
} from "lucide-react";

const navigation = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inbound",
    items: [
      { title: "Inbound Shipments", href: "/receiving", icon: PackageOpen },
      { title: "Discrepancies", href: "/receiving/discrepancies", icon: AlertTriangle },
    ],
  },
  {
    label: "Fulfillment",
    items: [
      { title: "Orders", href: "/orders", icon: ShoppingCart },
      { title: "Picking", href: "/picking", icon: ScanLine },
      { title: "Shipping", href: "/shipping", icon: Truck },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock Browser", href: "/inventory", icon: Boxes },
      { title: "Movements", href: "/inventory/movements", icon: ArrowLeftRight },
      { title: "Adjustments", href: "/inventory/adjustments", icon: ClipboardCheck },
      { title: "Cycle Counts", href: "/inventory/cycle-counts", icon: ListChecks },
    ],
  },
  {
    label: "Setup",
    items: [
      { title: "Locations", href: "/warehouse", icon: MapPin },
      { title: "Clients", href: "/clients", icon: Users },
      { title: "Products", href: "/products", icon: Package },
      { title: "Channels", href: "/channels", icon: Store },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3 },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

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
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
