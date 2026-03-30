/**
 * In-process event bus for real-time SSE broadcasting.
 *
 * Server actions call `publish(tenantId, eventType, payload)` to broadcast
 * changes. The SSE endpoint subscribes per-tenant and pushes events to
 * connected clients.
 *
 * This is an in-process EventEmitter — suitable for a single-server deploy.
 * For multi-server, swap in Redis pub/sub behind the same interface.
 */

import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WmsEventType =
  | "inventory_update"
  | "order_status"
  | "shipment_status"
  | "pick_task_update";

export interface WmsEvent {
  /** Event type for client-side filtering */
  type: WmsEventType;

  /** Tenant this event belongs to */
  tenantId: string;

  /** ISO timestamp */
  timestamp: string;

  /** Arbitrary JSON payload */
  payload: Record<string, unknown>;
}

export type EventCallback = (event: WmsEvent) => void;

// ─── Bus implementation ───────────────────────────────────────────────────────

class WmsEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Allow many concurrent SSE connections
    this.emitter.setMaxListeners(500);
  }

  /**
   * Publish an event to all subscribers of the given tenant.
   */
  publish(tenantId: string, type: WmsEventType, payload: Record<string, unknown>): void {
    const event: WmsEvent = {
      type,
      tenantId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.emitter.emit(`tenant:${tenantId}`, event);
  }

  /**
   * Subscribe to all events for a tenant.
   */
  subscribe(tenantId: string, callback: EventCallback): void {
    this.emitter.on(`tenant:${tenantId}`, callback);
  }

  /**
   * Unsubscribe a previously registered callback.
   */
  unsubscribe(tenantId: string, callback: EventCallback): void {
    this.emitter.off(`tenant:${tenantId}`, callback);
  }

  /**
   * Number of listeners for a tenant (useful for monitoring).
   */
  listenerCount(tenantId: string): number {
    return this.emitter.listenerCount(`tenant:${tenantId}`);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

// Use globalThis to survive Next.js HMR reloads in development
const globalKey = "__wmsEventBus";

function getEventBus(): WmsEventBus {
  const g = globalThis as unknown as Record<string, WmsEventBus>;
  if (!g[globalKey]) {
    g[globalKey] = new WmsEventBus();
  }
  return g[globalKey];
}

export const eventBus = getEventBus();

// ─── Convenience publishers ───────────────────────────────────────────────────

export function publishInventoryUpdate(
  tenantId: string,
  payload: { productId: string; binId?: string; [key: string]: unknown }
): void {
  eventBus.publish(tenantId, "inventory_update", payload);
}

export function publishOrderStatus(
  tenantId: string,
  payload: { orderId: string; status: string; [key: string]: unknown }
): void {
  eventBus.publish(tenantId, "order_status", payload);
}

export function publishShipmentStatus(
  tenantId: string,
  payload: { shipmentId: string; status: string; [key: string]: unknown }
): void {
  eventBus.publish(tenantId, "shipment_status", payload);
}

export function publishPickTaskUpdate(
  tenantId: string,
  payload: { taskId: string; status: string; [key: string]: unknown }
): void {
  eventBus.publish(tenantId, "pick_task_update", payload);
}
