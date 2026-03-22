"use client";

import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
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
            <span>Offline — actions are being queued</span>
          </>
        ) : isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Syncing {pendingCount} queued action(s)...</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            <span>{pendingCount} action(s) pending sync</span>
          </>
        )}
      </div>

      {isOnline && !isSyncing && pendingCount > 0 && onRetry && (
        <button
          onClick={onRetry}
          className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
        >
          Sync now
        </button>
      )}
    </div>
  );
}
