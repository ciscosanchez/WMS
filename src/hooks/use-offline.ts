"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  enqueueAction,
  getPendingActions,
  removeAction,
  incrementRetry,
  getQueueSize,
} from "@/lib/offline-queue";
import { toast } from "sonner";

const MAX_RETRIES = 3;

/**
 * Server action registry — maps "module:functionName" keys to their functions.
 *
 * Actions are registered by operator pages on mount via registerOfflineActions().
 * The registry is rebuilt on every page load from static imports, so it does not
 * need to persist — but queued actions whose key is not (yet) in the registry
 * are SKIPPED during replay, never deleted. They will be replayed once the user
 * navigates to a page that registers the matching action.
 */
const actionRegistry = new Map<string, (...args: unknown[]) => Promise<unknown>>();

/**
 * Register a batch of actions for offline replay.
 * Call this on mount in every operator page that has mutations.
 *
 * Example:
 *   registerOfflineActions("operator", {
 *     confirmPickLine,
 *     claimPickTask,
 *   });
 *
 * This registers keys like "operator:confirmPickLine".
 */
export function registerOfflineActions(
  module: string,
  actions: Record<string, (...args: unknown[]) => Promise<unknown>>
) {
  for (const [name, fn] of Object.entries(actions)) {
    actionRegistry.set(`${module}:${name}`, fn);
  }
}

/**
 * Build the action key stored in IndexedDB.
 */
export function actionKey(module: string, name: string): string {
  return `${module}:${name}`;
}

/**
 * Hook for offline-aware operator actions.
 *
 * - Tracks online/offline status
 * - Queues failed or offline actions to IndexedDB
 * - Replays queued actions when back online (skips unregistered, never deletes them)
 * - Listens for service worker replay messages
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(() => {
    getQueueSize()
      .then(setPendingCount)
      .catch(() => {});
  }, []);

  // Track online/offline
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      toast.success("Back online");
      replayQueue();
    };
    const goOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline — actions will be queued");
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Listen for service worker replay messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "REPLAY_OFFLINE_QUEUE") {
        replayQueue();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    // Check initial queue size
    refreshCount();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Request a Background Sync so the SW replays the queue when connectivity returns,
   * even if the user closes the tab.
   */
  const requestSync = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && "sync" in reg) {
        await (
          reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }
        ).sync.register("offline-queue-sync");
      }
    } catch {
      // Background Sync not supported — client-side replay is the fallback
    }
  }, []);

  /**
   * Execute a server action with offline fallback.
   * If offline or the action fails due to network error, queue it for later
   * and register a Background Sync so the SW replays when online.
   *
   * @param key - The registry key, e.g. "operator:confirmPickLine"
   * @param actionFn - The actual server action function
   * @param args - Arguments to pass to the action
   */
  const executeAction = useCallback(
    async <T>(
      key: string,
      actionFn: (...args: unknown[]) => Promise<T>,
      args: unknown[]
    ): Promise<{ result: T; queued: false } | { result: null; queued: true }> => {
      // Ensure action is registered for replay
      if (!actionRegistry.has(key)) {
        actionRegistry.set(key, actionFn as (...args: unknown[]) => Promise<unknown>);
      }

      if (!navigator.onLine) {
        await enqueueAction(key, args);
        refreshCount();
        await requestSync();
        toast.info("Action queued — will sync when online");
        return { result: null, queued: true };
      }

      try {
        const result = await actionFn(...args);
        return { result, queued: false };
      } catch (err) {
        // If it's a network error, queue it
        if (isNetworkError(err)) {
          await enqueueAction(key, args);
          refreshCount();
          await requestSync();
          toast.info("Network error — action queued for retry");
          return { result: null, queued: true };
        }
        throw err; // Re-throw application errors
      }
    },
    [refreshCount, requestSync]
  );

  const replayQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const actions = await getPendingActions();
      if (actions.length === 0) {
        setPendingCount(0);
        return;
      }

      toast.info(`Syncing ${actions.length} queued action(s)...`);
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      for (const action of actions) {
        const fn = actionRegistry.get(action.action);
        if (!fn) {
          // Action module not loaded yet — SKIP, do NOT delete.
          // It will be replayed when the user navigates to the right page.
          skipped++;
          continue;
        }

        try {
          await fn(...action.args);
          await removeAction(action.id!);
          succeeded++;
        } catch (err) {
          if (isNetworkError(err)) {
            // Still offline, stop replay
            break;
          }
          if (action.retries >= MAX_RETRIES) {
            await removeAction(action.id!);
            failed++;
          } else {
            await incrementRetry(action.id!);
          }
        }
      }

      refreshCount();

      if (succeeded > 0) {
        toast.success(`Synced ${succeeded} action(s)`);
      }
      if (failed > 0) {
        toast.error(`${failed} action(s) failed permanently`);
      }
      if (skipped > 0 && succeeded === 0 && failed === 0) {
        toast.info(`${skipped} action(s) waiting for page load to replay`);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    executeAction,
    replayQueue,
  };
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true;
  if (err instanceof TypeError && err.message.includes("network")) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}
