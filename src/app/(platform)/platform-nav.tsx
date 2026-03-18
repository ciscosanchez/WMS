"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Building2, Users, CreditCard, Shield } from "lucide-react";

const platformNav = [
  { title: "Dashboard", href: "/platform", icon: LayoutDashboard },
  { title: "Tenants", href: "/platform/tenants", icon: Building2 },
  { title: "Users", href: "/platform/users", icon: Users },
  { title: "Billing", href: "/platform/billing", icon: CreditCard },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Platform header */}
      <header className="sticky top-0 z-50 border-b bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
          <Link href="/platform" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold">Ramola Platform</span>
            <Badge className="bg-purple-600 text-white hover:bg-purple-600">Platform</Badge>
          </Link>

          <nav className="ml-8 flex items-center gap-1">
            {platformNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/platform" && pathname.startsWith(item.href + "/"));
              const isExactDashboard = item.href === "/platform" && pathname === "/platform";
              const active = isActive || isExactDashboard;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-purple-600/30 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">cisco@ramola.io</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-medium">
              CS
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
    </div>
  );
}
