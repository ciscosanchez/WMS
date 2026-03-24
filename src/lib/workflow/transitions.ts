/**
 * Workflow state machine guards.
 *
 * Each map defines which target statuses are reachable from a given source.
 * `assertTransition` throws if the caller attempts a jump that isn't in the map.
 */

// ── Order lifecycle ─────────────────────────────────────────────────────────
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["awaiting_fulfillment", "cancelled"],
  awaiting_fulfillment: ["allocated", "cancelled"],
  allocated: ["picking", "cancelled"],
  picking: ["picked", "cancelled"],
  picked: ["packing"],
  packing: ["packed"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// ── Inbound shipment lifecycle ──────────────────────────────────────────────
export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["expected", "cancelled"],
  expected: ["arrived", "cancelled"],
  arrived: ["receiving", "cancelled"],
  receiving: ["inspection", "completed"],
  inspection: ["completed"],
  completed: [],
  cancelled: [],
};

// ── Pick task lifecycle ────────────────────────────────────────────────────
export const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "in_progress"],
  assigned: ["in_progress", "pending"],
  in_progress: ["completed", "short_picked"],
  completed: [],
  short_picked: [],
};

// ── Outbound shipment lifecycle ────────────────────────────────────────────
export const OUTBOUND_SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// ── Dock appointment lifecycle ─────────────────────────────────────────────
export const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["at_dock", "cancelled"],
  at_dock: ["loading", "unloading"],
  loading: ["completed"],
  unloading: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

// ── RMA lifecycle ──────────────────────────────────────────────────────────
export const RMA_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected", "rma_cancelled"],
  approved: ["in_transit", "rma_cancelled"],
  in_transit: ["received"],
  received: ["inspecting"],
  inspecting: ["dispositioned"],
  dispositioned: ["rma_completed"],
  rma_completed: [],
  rejected: [],
  rma_cancelled: [],
};

// ── Yard visit lifecycle ───────────────────────────────────────────────────
export const YARD_VISIT_TRANSITIONS: Record<string, string[]> = {
  in_yard: ["at_dock", "departed"],
  at_dock: ["in_yard", "departed"],
  departed: [],
};

/**
 * Throws if `from → to` is not an allowed transition in `map`.
 */
export function assertTransition(
  entity: string,
  from: string,
  to: string,
  map: Record<string, string[]>
) {
  const allowed = map[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(
      `Invalid ${entity} transition: "${from}" → "${to}". ` +
        `Allowed from "${from}": ${allowed?.length ? allowed.join(", ") : "(terminal state)"}`
    );
  }
}
