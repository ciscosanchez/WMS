"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { checkPermissionLevel } from "@/lib/auth/rbac";
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
  Calendar,
  Map,
  UserCheck,
  HardHat,
  Clock,
  DollarSign,
  RotateCcw,
  Repeat,
  Puzzle,
  TrendingUp,
  Shield,
  Bot,
  Receipt,
  Zap,
  FileCheck,
} from "lucide-react";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

type NavItem = {
  titleKey: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
};
type NavGroup = { labelKey: string; items: NavItem[] };

const navigation: NavGroup[] = [
  {
    labelKey: "overview",
    items: [
      {
        titleKey: "dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "reports:read",
      },
      { titleKey: "operations", href: "/operations", icon: Users, permission: "reports:read" },
    ],
  },
  {
    labelKey: "inbound",
    items: [
      {
        titleKey: "inboundShipments",
        href: "/receiving",
        icon: PackageOpen,
        permission: "receiving:read",
      },
      {
        titleKey: "discrepancies",
        href: "/receiving/discrepancies",
        icon: AlertTriangle,
        permission: "receiving:read",
      },
    ],
  },
  {
    labelKey: "labor",
    items: [
      { titleKey: "laborDashboard", href: "/labor", icon: HardHat, permission: "operator:read" },
      { titleKey: "shifts", href: "/labor/shifts", icon: Clock, permission: "operator:read" },
      {
        titleKey: "laborCosts",
        href: "/labor/costs",
        icon: DollarSign,
        permission: "settings:read",
      },
    ],
  },
  {
    labelKey: "yardDock",
    items: [
      {
        titleKey: "dockSchedule",
        href: "/yard-dock",
        icon: Calendar,
        permission: "yard-dock:read",
      },
      {
        titleKey: "appointments",
        href: "/yard-dock/appointments",
        icon: ClipboardCheck,
        permission: "yard-dock:read",
      },
      { titleKey: "yardMap", href: "/yard-dock/yard-map", icon: Map, permission: "yard-dock:read" },
      {
        titleKey: "yardSpots",
        href: "/yard-dock/yard-spots",
        icon: MapPin,
        permission: "yard-dock:read",
      },
      {
        titleKey: "dockDoors",
        href: "/yard-dock/dock-doors",
        icon: Warehouse,
        permission: "yard-dock:read",
      },
      {
        titleKey: "driverCheckIn",
        href: "/yard-dock/check-in",
        icon: UserCheck,
        permission: "yard-dock:write",
      },
    ],
  },
  {
    labelKey: "fulfillment",
    items: [
      { titleKey: "orders", href: "/orders", icon: ShoppingCart, permission: "orders:read" },
      { titleKey: "picking", href: "/picking", icon: ScanLine, permission: "shipping:read" },
      { titleKey: "shipping", href: "/shipping", icon: Truck, permission: "shipping:read" },
      {
        titleKey: "cartonTypes",
        href: "/shipping/carton-types",
        icon: Boxes,
        permission: "shipping:read",
      },
      { titleKey: "returns", href: "/returns", icon: RotateCcw, permission: "returns:read" },
      {
        titleKey: "crossDock",
        href: "/shipping/cross-dock",
        icon: Repeat,
        permission: "cross_dock:read",
      },
      {
        titleKey: "customs",
        href: "/shipping/customs",
        icon: FileCheck,
        permission: "customs:read",
      },
      {
        titleKey: "compliance",
        href: "/shipping/compliance",
        icon: Shield,
        permission: "shipping:read",
      },
      {
        titleKey: "gs1Labels",
        href: "/shipping/labels",
        icon: ScanLine,
        permission: "shipping:read",
      },
    ],
  },
  {
    labelKey: "inventory",
    items: [
      { titleKey: "stockBrowser", href: "/inventory", icon: Boxes, permission: "inventory:read" },
      { titleKey: "lpn", href: "/inventory/lpn", icon: Package, permission: "inventory:read" },
      {
        titleKey: "putaway",
        href: "/inventory/putaway",
        icon: ArrowDownToLine,
        permission: "inventory:read",
      },
      {
        titleKey: "movements",
        href: "/inventory/movements",
        icon: ArrowLeftRight,
        permission: "inventory:read",
      },
      {
        titleKey: "adjustments",
        href: "/inventory/adjustments",
        icon: ClipboardCheck,
        permission: "inventory:read",
      },
      {
        titleKey: "cycleCounts",
        href: "/inventory/cycle-counts",
        icon: ListChecks,
        permission: "inventory:read",
      },
      {
        titleKey: "slotting",
        href: "/inventory/slotting",
        icon: BarChart3,
        permission: "inventory:read",
      },
      {
        titleKey: "expiring",
        href: "/inventory/expiring",
        icon: AlertTriangle,
        permission: "inventory:read",
      },
      {
        titleKey: "transfers",
        href: "/inventory/transfers",
        icon: Truck,
        permission: "inventory:read",
      },
      {
        titleKey: "replenishment",
        href: "/inventory/replenishment",
        icon: ArrowDownToLine,
        permission: "inventory:read",
      },
    ],
  },
  {
    labelKey: "setup",
    items: [
      { titleKey: "locations", href: "/warehouse", icon: MapPin, permission: "warehouse:read" },
      { titleKey: "clients", href: "/clients", icon: Users, permission: "clients:read" },
      { titleKey: "products", href: "/products", icon: Package, permission: "products:read" },
      { titleKey: "kits", href: "/products/kits", icon: Puzzle, permission: "products:read" },
      { titleKey: "channels", href: "/channels", icon: Store, permission: "orders:read" },
      {
        titleKey: "automation",
        href: "/warehouse/automation",
        icon: Bot,
        permission: "warehouse:read",
      },
      {
        titleKey: "workflowRules",
        href: "/settings/rules",
        icon: Zap,
        permission: "settings:read",
      },
    ],
  },
  {
    labelKey: "billing",
    items: [
      { titleKey: "billingDashboard", href: "/billing", icon: Receipt, permission: "billing:read" },
    ],
  },
  {
    labelKey: "system",
    items: [
      { titleKey: "analytics", href: "/analytics", icon: TrendingUp, permission: "reports:read" },
      { titleKey: "reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
      { titleKey: "settings", href: "/settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

type SidebarSession = {
  isSuperadmin?: boolean;
  tenants?: Array<{
    slug: string;
    role: TenantRole;
    permissionOverrides?: {
      grants: string[];
      denies: string[];
    } | null;
  }>;
};

function getTenantSlugFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.hostname.split(".");
  return parts.length >= 4 ? parts[0] : null;
}

function getCurrentMembership(sessionUser: SidebarSession | undefined) {
  if (USE_MOCK || sessionUser?.isSuperadmin) {
    return { role: "admin" as TenantRole, permissionOverrides: null };
  }

  const tenants = sessionUser?.tenants ?? [];
  if (tenants.length === 0) return null;

  const tenantSlug = getTenantSlugFromHost();
  const matchedTenant = tenantSlug ? tenants.find((tenant) => tenant.slug === tenantSlug) : null;
  return matchedTenant ?? tenants[0] ?? null;
}

function canAccessNavItem(
  item: NavItem,
  membership: {
    role: TenantRole;
    permissionOverrides?: { grants: string[]; denies: string[] } | null;
  } | null
): boolean {
  if (!item.permission) return true;
  if (!membership) return false;
  return checkPermissionLevel(membership.role, item.permission, membership.permissionOverrides);
}

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { data: session, status } = useSession();
  const currentMembership = getCurrentMembership(session?.user as SidebarSession | undefined);
  const visibleGroups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavItem(item, currentMembership)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Ramola</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
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
        {status !== "loading" &&
        canAccessNavItem(
          {
            titleKey: "floorApp",
            href: "/receive",
            icon: Smartphone,
            permission: "operator:write",
          },
          currentMembership
        ) ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/receive" />}>
                <Smartphone className="h-4 w-4" />
                <span>{t("floorApp")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
