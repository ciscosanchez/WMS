/**
 * @jest-environment node
 *
 * Tests for workflow state machine transition guards.
 * Pure-function tests — no mocking needed.
 *
 * Covers: CROSS_DOCK_TRANSITIONS, RMA_TRANSITIONS,
 *         APPOINTMENT_TRANSITIONS, YARD_VISIT_TRANSITIONS
 */

import {
  assertTransition,
  CROSS_DOCK_TRANSITIONS,
  RMA_TRANSITIONS,
  APPOINTMENT_TRANSITIONS,
  YARD_VISIT_TRANSITIONS,
} from "@/lib/workflow/transitions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function expectAllowed(entity: string, from: string, to: string, map: Record<string, string[]>) {
  expect(() => assertTransition(entity, from, to, map)).not.toThrow();
}

function expectBlocked(entity: string, from: string, to: string, map: Record<string, string[]>) {
  expect(() => assertTransition(entity, from, to, map)).toThrow(/Invalid/);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Cross-dock transitions", () => {
  it("cd_identified -> cd_approved: allowed", () => {
    expectAllowed("cross_dock", "cd_identified", "cd_approved", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_identified -> cd_cancelled: allowed", () => {
    expectAllowed("cross_dock", "cd_identified", "cd_cancelled", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_identified -> cd_completed: blocked (invalid skip)", () => {
    expectBlocked("cross_dock", "cd_identified", "cd_completed", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_approved -> cd_in_progress: allowed", () => {
    expectAllowed("cross_dock", "cd_approved", "cd_in_progress", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_approved -> cd_cancelled: allowed", () => {
    expectAllowed("cross_dock", "cd_approved", "cd_cancelled", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_in_progress -> cd_completed: allowed", () => {
    expectAllowed("cross_dock", "cd_in_progress", "cd_completed", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_completed -> anything: blocked (terminal state)", () => {
    expectBlocked("cross_dock", "cd_completed", "cd_identified", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_completed", "cd_approved", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_completed", "cd_in_progress", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_completed", "cd_cancelled", CROSS_DOCK_TRANSITIONS);
  });

  it("cd_cancelled -> anything: blocked (terminal state)", () => {
    expectBlocked("cross_dock", "cd_cancelled", "cd_identified", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_cancelled", "cd_approved", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_cancelled", "cd_in_progress", CROSS_DOCK_TRANSITIONS);
    expectBlocked("cross_dock", "cd_cancelled", "cd_completed", CROSS_DOCK_TRANSITIONS);
  });
});

describe("RMA transitions", () => {
  it("requested -> approved: allowed", () => {
    expectAllowed("rma", "requested", "approved", RMA_TRANSITIONS);
  });

  it("requested -> rma_completed: blocked (invalid skip)", () => {
    expectBlocked("rma", "requested", "rma_completed", RMA_TRANSITIONS);
  });

  it("requested -> rejected: allowed", () => {
    expectAllowed("rma", "requested", "rejected", RMA_TRANSITIONS);
  });

  it("rma_completed -> anything: blocked (terminal)", () => {
    expectBlocked("rma", "rma_completed", "requested", RMA_TRANSITIONS);
    expectBlocked("rma", "rma_completed", "approved", RMA_TRANSITIONS);
  });

  it("rejected -> anything: blocked (terminal)", () => {
    expectBlocked("rma", "rejected", "requested", RMA_TRANSITIONS);
    expectBlocked("rma", "rejected", "approved", RMA_TRANSITIONS);
  });
});

describe("Appointment transitions", () => {
  it("scheduled -> confirmed: allowed", () => {
    expectAllowed("appointment", "scheduled", "confirmed", APPOINTMENT_TRANSITIONS);
  });

  it("scheduled -> completed: blocked (invalid skip)", () => {
    expectBlocked("appointment", "scheduled", "completed", APPOINTMENT_TRANSITIONS);
  });

  it("scheduled -> cancelled: allowed", () => {
    expectAllowed("appointment", "scheduled", "cancelled", APPOINTMENT_TRANSITIONS);
  });

  it("confirmed -> checked_in: allowed", () => {
    expectAllowed("appointment", "confirmed", "checked_in", APPOINTMENT_TRANSITIONS);
  });

  it("completed -> anything: blocked (terminal)", () => {
    expectBlocked("appointment", "completed", "scheduled", APPOINTMENT_TRANSITIONS);
    expectBlocked("appointment", "completed", "confirmed", APPOINTMENT_TRANSITIONS);
  });

  it("no_show -> anything: blocked (terminal)", () => {
    expectBlocked("appointment", "no_show", "scheduled", APPOINTMENT_TRANSITIONS);
    expectBlocked("appointment", "no_show", "confirmed", APPOINTMENT_TRANSITIONS);
  });
});

describe("Yard visit transitions", () => {
  it("in_yard -> at_dock: allowed", () => {
    expectAllowed("yard_visit", "in_yard", "at_dock", YARD_VISIT_TRANSITIONS);
  });

  it("in_yard -> departed: allowed", () => {
    expectAllowed("yard_visit", "in_yard", "departed", YARD_VISIT_TRANSITIONS);
  });

  it("at_dock -> in_yard: allowed", () => {
    expectAllowed("yard_visit", "at_dock", "in_yard", YARD_VISIT_TRANSITIONS);
  });

  it("at_dock -> departed: allowed", () => {
    expectAllowed("yard_visit", "at_dock", "departed", YARD_VISIT_TRANSITIONS);
  });

  it("departed -> anything: blocked (terminal)", () => {
    expectBlocked("yard_visit", "departed", "in_yard", YARD_VISIT_TRANSITIONS);
    expectBlocked("yard_visit", "departed", "at_dock", YARD_VISIT_TRANSITIONS);
  });
});
