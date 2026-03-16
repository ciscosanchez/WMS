"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  receiving: "Receiving",
  inventory: "Inventory",
  warehouse: "Warehouse",
  clients: "Clients",
  products: "Products",
  reports: "Reports",
  settings: "Settings",
  discrepancies: "Discrepancies",
  movements: "Movements",
  adjustments: "Adjustments",
  "cycle-counts": "Cycle Counts",
  putaway: "Putaway",
  rules: "Rules",
  billing: "Billing",
  users: "Users",
  invite: "Invite",
  channels: "Channels",
  picking: "Picking",
  shipping: "Shipping",
  orders: "Orders",
  portal: "Portal",
  platform: "Platform",
  tenants: "Tenants",
  new: "New",
  edit: "Edit",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const label = labels[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
