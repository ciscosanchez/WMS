"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker on mount.
 * Sends CLIENT_READY message so the SW can trigger offline queue replay
 * if a sync event fired while no tabs were open.
 */
export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);

        // Tell the SW this client is ready to receive replay messages
        if (reg.active) {
          reg.active.postMessage({ type: "CLIENT_READY" });
        }

        // Also handle the case where SW activates after registration
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                newWorker.postMessage({ type: "CLIENT_READY" });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return { registration };
}
