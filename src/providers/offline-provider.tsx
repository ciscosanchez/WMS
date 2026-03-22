"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useOffline } from "@/hooks/use-offline";
import { registerAllOfflineActions } from "@/lib/offline-actions-registry";

type OfflineContextValue = ReturnType<typeof useOffline>;

const OfflineContext = createContext<OfflineContextValue | null>(null);

/**
 * Provides a single shared useOffline() instance to the entire operator app.
 * Wrap the operator layout with this so the banner and all pages share
 * the same pendingCount, isSyncing, and executeAction.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const offline = useOffline();
  const registered = useRef(false);

  // Register ALL operator actions once on mount — not page-dependent.
  // This ensures replay can execute any queued action regardless of
  // which operator page is currently loaded.
  useEffect(() => {
    if (!registered.current) {
      registerAllOfflineActions();
      registered.current = true;
    }
  }, []);

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
