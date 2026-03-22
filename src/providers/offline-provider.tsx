"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOffline } from "@/hooks/use-offline";

type OfflineContextValue = ReturnType<typeof useOffline>;

const OfflineContext = createContext<OfflineContextValue | null>(null);

/**
 * Provides a single shared useOffline() instance to the entire operator app.
 * Wrap the operator layout with this so the banner and all pages share
 * the same pendingCount, isSyncing, and executeAction.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const offline = useOffline();
  return (
    <OfflineContext.Provider value={offline}>{children}</OfflineContext.Provider>
  );
}

/**
 * Access the shared offline context.
 * Must be used within <OfflineProvider>.
 */
export function useSharedOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useSharedOffline must be used within <OfflineProvider>");
  }
  return ctx;
}
