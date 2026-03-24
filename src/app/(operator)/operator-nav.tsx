"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Warehouse,
  LayoutDashboard,
  PackageOpen,
  ScanLine,
  Package,
  ArrowLeftRight,
  ListChecks,
  Sun,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import { useSharedOffline } from "@/providers/offline-provider";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { useSessionKeepalive } from "@/hooks/use-session-keepalive";
import { useHighContrast } from "@/hooks/use-high-contrast";

const navKeys = [
  { href: "/my-tasks", key: "home" as const, icon: LayoutDashboard },
  { href: "/receive", key: "receive" as const, icon: PackageOpen },
  { href: "/pick", key: "pick" as const, icon: ScanLine },
  { href: "/pack", key: "pack" as const, icon: Package },
  { href: "/move", key: "move" as const, icon: ArrowLeftRight },
  { href: "/count", key: "count" as const, icon: ListChecks },
];

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOnline, pendingCount, isSyncing, replayQueue } = useSharedOffline();
  const { highContrast, toggleHighContrast } = useHighContrast();
  const { sessionExpired, refreshSession } = useSessionKeepalive();
  const t = useTranslations("operator.nav");
  const tc = useTranslations("common");

  // Register service worker
  useServiceWorker();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Offline banner */}
      <OfflineIndicator
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onRetry={replayQueue}
      />

      {/* Session expired overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 rounded-lg bg-white p-6 text-center shadow-xl">
            <LogIn className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-bold">{tc("sessionExpired")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tc("sessionExpiredMessage")}
            </p>
            <button
              onClick={refreshSession}
              className="mt-4 h-12 w-full rounded-md bg-primary px-4 text-primary-foreground font-semibold"
            >
              {tc("signIn")}
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/my-tasks" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Ramola</span>
          <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            {tc("floor")}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleHighContrast}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              highContrast
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={tc("toggleHighContrast")}
            title={highContrast ? tc("highContrastOn") : tc("highContrastOff")}
          >
            <Sun className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">Carlos M.</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>

      {/* Bottom navigation — mobile-optimized */}
      <nav className="border-t bg-background">
        <div className="flex justify-around">
          {navKeys.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
