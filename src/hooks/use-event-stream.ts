"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WmsEvent, WmsEventType } from "@/lib/events/event-bus";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseEventStreamOptions {
  /** Event types to listen for. Omit or pass empty array for all types. */
  eventTypes?: WmsEventType[];

  /** Whether the stream is enabled (default: true) */
  enabled?: boolean;

  /** Max events to keep in the buffer (default: 50) */
  bufferSize?: number;
}

interface UseEventStreamReturn {
  /** Most recent events (newest first), capped at bufferSize */
  events: WmsEvent[];

  /** Whether the SSE connection is currently open */
  connected: boolean;

  /** Last connection error, if any */
  error: string | null;
}

// ─── Query key mapping ───────────────────────────────────────────────────────

/**
 * Maps SSE event types to React Query keys that should be invalidated.
 * Adjust these to match your actual query key conventions.
 */
const INVALIDATION_MAP: Record<WmsEventType, string[][]> = {
  inventory_update: [["inventory"]],
  order_status: [["orders"]],
  shipment_status: [["shipments"]],
  pick_task_update: [["pickTasks"], ["picking"]],
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamReturn {
  const { eventTypes, enabled = true, bufferSize = 50 } = options;

  const [events, setEvents] = useState<WmsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);

  const handleEvent = useCallback(
    (event: WmsEvent) => {
      // Buffer the event
      setEvents((prev) => [event, ...prev].slice(0, bufferSize));

      // Invalidate relevant React Query caches
      const keys = INVALIDATION_MAP[event.type];
      if (keys) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
    [bufferSize, queryClient]
  );

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL with optional type filter
    const params = new URLSearchParams();
    if (eventTypes && eventTypes.length > 0) {
      params.set("types", eventTypes.join(","));
    }

    const url = `/api/events${params.toString() ? `?${params}` : ""}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
      setError(null);
      reconnectDelayRef.current = 1000; // Reset backoff on success
    });

    // Listen for each known event type
    const knownTypes: WmsEventType[] = [
      "inventory_update",
      "order_status",
      "shipment_status",
      "pick_task_update",
    ];

    for (const type of knownTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed: WmsEvent = JSON.parse(e.data);
          handleEvent(parsed);
        } catch {
          // Ignore malformed events
        }
      });
    }

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect (max 30s)
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      setError(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [eventTypes, handleEvent]);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { events, connected, error };
}
