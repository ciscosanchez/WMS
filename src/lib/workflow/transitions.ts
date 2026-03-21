/**
 * Workflow state machine guards.
 *
 * Each map defines which target statuses are reachable from a given source.
 * `assertTransition` throws if the caller attempts a jump that isn't in the map.
 */

// ── Order lifecycle ─────────────────────────────────────────────────────────
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending:               ["awaiting_fulfillment", "cancelled"],
  awaiting_fulfillment:  ["allocated", "cancelled"],
  allocated:             ["picking", "cancelled"],
  picking:               ["picked", "cancelled"],
  picked:                ["packing"],
  packing:               ["packed"],
  packed:                ["shipped"],
  shipped:               ["delivered"],
  delivered:             [],
  cancelled:             [],
};

// ── Inbound shipment lifecycle ──────────────────────────────────────────────
export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft:      ["expected", "cancelled"],
  expected:   ["arrived", "cancelled"],
  arrived:    ["receiving", "cancelled"],
  receiving:  ["inspection", "completed"],
  inspection: ["completed"],
  completed:  [],
  cancelled:  [],
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
