/**
 * Ramola WMS — Service Worker
 *
 * Caches the operator app shell and static assets for offline use.
 * On background sync, notifies open clients to replay their IndexedDB queue.
 * If no clients are open, sync is deferred until next page load.
 */

const CACHE_NAME = "ramola-wms-v1";

const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Operator app routes — precached on install for offline shell
const APP_SHELL_ROUTES = [
  "/my-tasks",
  "/receive",
  "/pick",
  "/pack",
  "/move",
  "/count",
];

// ─── Install ──────────────────────────────────────────────
// Precache both static assets AND app shell routes so the operator
// can open any page even if they go offline before visiting it.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([...STATIC_ASSETS, ...APP_SHELL_ROUTES])
    )
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch Strategy ───────────────────────────────────────
// Network-first for navigations and API, cache-first for static assets.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (mutations handled by offline queue on the client)
  if (request.method !== "GET") return;

  // Skip auth-related requests — never cache these
  if (url.pathname.startsWith("/api/auth")) return;

  // Skip API routes entirely — must always be fresh
  if (url.pathname.startsWith("/api/")) return;

  // Static assets (immutable builds, icons): cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.json" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Operator app shell + Next.js chunks: network-first, cache fallback
  const isAppShell = APP_SHELL_ROUTES.some(
    (route) => url.pathname === route || url.pathname.startsWith(route + "/")
  );
  if (isAppShell || url.pathname.startsWith("/_next/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            // If no cache hit for a navigation, return the /my-tasks shell as fallback
            if (cached) return cached;
            if (request.mode === "navigate") {
              return caches.match("/my-tasks");
            }
            return cached;
          })
        )
    );
    return;
  }
});

// ─── Background Sync ──────────────────────────────────────
// When connectivity returns, notify open clients to replay their queue.
// If no clients are open, we can't replay (actions need client-side context),
// so we re-register the sync tag to retry when a client opens.
self.addEventListener("sync", (event) => {
  if (event.tag === "offline-queue-sync") {
    event.waitUntil(handleSync());
  }
});

async function handleSync() {
  const clients = await self.clients.matchAll({ type: "window" });

  if (clients.length === 0) {
    // No open tabs — re-register sync so it fires again when a tab opens.
    // The client's useOffline hook will also check the queue on mount.
    try {
      await self.registration.sync.register("offline-queue-sync");
    } catch {
      // Background Sync API not supported — client will handle on next load
    }
    return;
  }

  // Notify all open clients to replay their offline queues
  for (const client of clients) {
    client.postMessage({ type: "REPLAY_OFFLINE_QUEUE" });
  }
}

// Also notify clients when they first connect (covers the "tab opened after sync" case)
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLIENT_READY") {
    // Client just loaded — tell it to check its queue
    event.source?.postMessage({ type: "REPLAY_OFFLINE_QUEUE" });
  }
});

// ─── Push Notifications (future) ──────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Ramola WMS", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "default",
    })
  );
});
