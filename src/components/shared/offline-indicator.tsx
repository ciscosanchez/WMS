"use client";

import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onRetry?: () => void;
}

export function OfflineIndicator({
  isOnline,
  pendingCount,
  isSyncing,
  onRetry,
}: OfflineIndicatorProps) {
  const t = useTranslations("common");

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 text-sm font-medium",
        !isOnline
          ? "bg-red-600 text-white"
          : isSyncing
            ? "bg-blue-600 text-white"
            : "bg-amber-500 text-white"
      )}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{t("offline")}</span>
          </>
        ) : isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("syncing", { count: pendingCount })}</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            <span>{t("pendingSync", { count: pendingCount })}</span>
          </>
        )}
      </div>

      {isOnline && !isSyncing && pendingCount > 0 && onRetry && (
        <button
          onClick={onRetry}
          className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
        >
          {t("syncNow")}
        </button>
      )}
    </div>
  );
}
