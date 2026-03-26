"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Package,
  ClipboardList,
  Truck,
  Receipt,
  BarChart3,
  ChevronDown,
  LogOut,
  Settings,
  Building2,
} from "lucide-react";

const navLinks = [
  { href: "/portal/inventory", label: "Inventory", icon: Package },
  { href: "/portal/orders", label: "Orders", icon: ClipboardList },
  { href: "/portal/shipments", label: "Shipments", icon: Truck },
  { href: "/portal/billing", label: "Billing", icon: Receipt },
  { href: "/portal/reports", label: "Reports", icon: BarChart3 },
];

export default function PortalLayout({
  children,
  accountName,
  accountCode,
  userName,
}: {
  children: React.ReactNode;
  accountName: string;
  accountCode: string | null;
  userName: string;
}) {
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.href = `${window.location.origin}/login`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          {/* Logo */}
          <Link href="/portal/inventory" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Ramola WMS</span>
            <Badge variant="outline" className="text-xs font-normal">
              Portal
            </Badge>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{accountName}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {accountCode ? `Client ${accountCode}` : "Portal access"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl flex-1 p-6">{children}</main>

      <footer className="border-t py-4">
        <p className="text-center text-xs text-muted-foreground">
          Powered by Ramola WMS &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
