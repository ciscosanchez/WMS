import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTenantFromHeaders, resolveTenant } from "@/lib/tenant/context";
import { eventBus, type WmsEvent, type EventCallback } from "@/lib/events/event-bus";

const KEEPALIVE_INTERVAL_MS = 30_000;

/**
 * GET /api/events — Server-Sent Events endpoint
 *
 * Streams real-time WMS events (inventory updates, order status changes, etc.)
 * to authenticated clients. Events are scoped to the caller's tenant.
 *
 * Query params:
 *   types — comma-separated event types to filter (optional, default: all)
 */
export async function GET(request: NextRequest) {
  // ─── Auth ─────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const slug = await getTenantFromHeaders();
  if (!slug) {
    return new Response("Missing tenant context", { status: 400 });
  }

  const tenant = await resolveTenant();
  if (!tenant) {
    return new Response("Tenant not found", { status: 404 });
  }

  // ─── Parse optional type filter ───────────────────────────
  const typesParam = request.nextUrl.searchParams.get("types");
  const allowedTypes = typesParam ? new Set(typesParam.split(",").map((t) => t.trim())) : null;

  // ─── SSE stream ───────────────────────────────────────────
  const encoder = new TextEncoder();
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let eventHandler: EventCallback | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ tenantId: tenant.tenantId })}\n\n`
        )
      );

      // Subscribe to tenant events
      eventHandler = (event: WmsEvent) => {
        if (allowedTypes && !allowedTypes.has(event.type)) return;

        try {
          const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // Stream closed — cleanup handled by cancel()
        }
      };

      eventBus.subscribe(tenant.tenantId, eventHandler);

      // Keepalive ping every 30s to prevent proxy/LB timeout
      keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Stream closed
        }
      }, KEEPALIVE_INTERVAL_MS);
    },

    cancel() {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      if (eventHandler) eventBus.unsubscribe(tenant.tenantId, eventHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
