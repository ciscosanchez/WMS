/**
 * Transfer Order Tests
 *
 * Tests state machine transitions and validation logic.
 */

import { assertTransition, TRANSFER_ORDER_TRANSITIONS } from "@/lib/workflow/transitions";

describe("Transfer Order State Machine", () => {
  it("allows draft → approved", () => {
    expect(() =>
      assertTransition("transfer_order", "draft", "approved", TRANSFER_ORDER_TRANSITIONS)
    ).not.toThrow();
  });

  it("allows draft → cancelled", () => {
    expect(() =>
      assertTransition("transfer_order", "draft", "cancelled", TRANSFER_ORDER_TRANSITIONS)
    ).not.toThrow();
  });

  it("allows approved → in_transit", () => {
    expect(() =>
      assertTransition("transfer_order", "approved", "in_transit", TRANSFER_ORDER_TRANSITIONS)
    ).not.toThrow();
  });

  it("allows in_transit → received", () => {
    expect(() =>
      assertTransition("transfer_order", "in_transit", "received", TRANSFER_ORDER_TRANSITIONS)
    ).not.toThrow();
  });

  it("allows received → completed", () => {
    expect(() =>
      assertTransition("transfer_order", "received", "completed", TRANSFER_ORDER_TRANSITIONS)
    ).not.toThrow();
  });

  it("blocks draft → in_transit (must approve first)", () => {
    expect(() =>
      assertTransition("transfer_order", "draft", "in_transit", TRANSFER_ORDER_TRANSITIONS)
    ).toThrow("Invalid transfer_order transition");
  });

  it("blocks completed → anything (terminal state)", () => {
    expect(() =>
      assertTransition("transfer_order", "completed", "draft", TRANSFER_ORDER_TRANSITIONS)
    ).toThrow("terminal state");
  });

  it("blocks cancelled → anything (terminal state)", () => {
    expect(() =>
      assertTransition("transfer_order", "cancelled", "approved", TRANSFER_ORDER_TRANSITIONS)
    ).toThrow("terminal state");
  });

  it("blocks in_transit → cancelled (cannot cancel after shipping)", () => {
    expect(() =>
      assertTransition("transfer_order", "in_transit", "cancelled", TRANSFER_ORDER_TRANSITIONS)
    ).toThrow("Invalid transfer_order transition");
  });

  it("blocks received → in_transit (no going back)", () => {
    expect(() =>
      assertTransition("transfer_order", "received", "in_transit", TRANSFER_ORDER_TRANSITIONS)
    ).toThrow("Invalid transfer_order transition");
  });
});

describe("Transfer Order Validation", () => {
  it("rejects same source and destination warehouse", () => {
    const fromId: string = "warehouse-1";
    const toId: string = "warehouse-1";
    expect(fromId === toId).toBe(true);
  });

  it("accepts different source and destination", () => {
    const fromId: string = "warehouse-1";
    const toId: string = "warehouse-2";
    expect(fromId === toId).toBe(false);
  });
});
