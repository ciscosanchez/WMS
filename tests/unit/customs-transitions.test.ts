/**
 * @jest-environment node
 *
 * Tests for customs entry workflow transitions and actions.
 * Part 1: Pure-function transition guards (no mocking).
 * Part 2: createCustomsEntry / updateEntryStatus with mocked DB.
 */

import { assertTransition, CUSTOMS_ENTRY_TRANSITIONS } from "@/lib/workflow/transitions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function expectAllowed(from: string, to: string) {
  expect(() =>
    assertTransition("customs_entry", from, to, CUSTOMS_ENTRY_TRANSITIONS)
  ).not.toThrow();
}

function expectBlocked(from: string, to: string) {
  expect(() => assertTransition("customs_entry", from, to, CUSTOMS_ENTRY_TRANSITIONS)).toThrow(
    /Invalid/
  );
}

// ── Part 1: Transition guards ───────────────────────────────────────────────

describe("CUSTOMS_ENTRY_TRANSITIONS", () => {
  // ce_draft
  it("ce_draft -> ce_pending: allowed", () => expectAllowed("ce_draft", "ce_pending"));
  it("ce_draft -> ce_filed: allowed", () => expectAllowed("ce_draft", "ce_filed"));
  it("ce_draft -> ce_cleared: blocked", () => expectBlocked("ce_draft", "ce_cleared"));
  it("ce_draft -> ce_held: blocked", () => expectBlocked("ce_draft", "ce_held"));
  it("ce_draft -> ce_rejected: blocked", () => expectBlocked("ce_draft", "ce_rejected"));

  // ce_pending
  it("ce_pending -> ce_filed: allowed", () => expectAllowed("ce_pending", "ce_filed"));
  it("ce_pending -> ce_draft: allowed", () => expectAllowed("ce_pending", "ce_draft"));
  it("ce_pending -> ce_cleared: blocked", () => expectBlocked("ce_pending", "ce_cleared"));
  it("ce_pending -> ce_held: blocked", () => expectBlocked("ce_pending", "ce_held"));

  // ce_filed
  it("ce_filed -> ce_cleared: allowed", () => expectAllowed("ce_filed", "ce_cleared"));
  it("ce_filed -> ce_held: allowed", () => expectAllowed("ce_filed", "ce_held"));
  it("ce_filed -> ce_rejected: allowed", () => expectAllowed("ce_filed", "ce_rejected"));
  it("ce_filed -> ce_draft: blocked", () => expectBlocked("ce_filed", "ce_draft"));
  it("ce_filed -> ce_pending: blocked", () => expectBlocked("ce_filed", "ce_pending"));

  // ce_held
  it("ce_held -> ce_cleared: allowed", () => expectAllowed("ce_held", "ce_cleared"));
  it("ce_held -> ce_rejected: allowed", () => expectAllowed("ce_held", "ce_rejected"));
  it("ce_held -> ce_draft: blocked", () => expectBlocked("ce_held", "ce_draft"));
  it("ce_held -> ce_pending: blocked", () => expectBlocked("ce_held", "ce_pending"));
  it("ce_held -> ce_filed: blocked", () => expectBlocked("ce_held", "ce_filed"));

  // ce_cleared (terminal)
  it("ce_cleared -> anything: blocked (terminal)", () => {
    expectBlocked("ce_cleared", "ce_draft");
    expectBlocked("ce_cleared", "ce_pending");
    expectBlocked("ce_cleared", "ce_filed");
    expectBlocked("ce_cleared", "ce_held");
    expectBlocked("ce_cleared", "ce_rejected");
  });

  // ce_rejected
  it("ce_rejected -> ce_draft: allowed", () => expectAllowed("ce_rejected", "ce_draft"));
  it("ce_rejected -> ce_pending: blocked", () => expectBlocked("ce_rejected", "ce_pending"));
  it("ce_rejected -> ce_filed: blocked", () => expectBlocked("ce_rejected", "ce_filed"));
  it("ce_rejected -> ce_cleared: blocked", () => expectBlocked("ce_rejected", "ce_cleared"));
  it("ce_rejected -> ce_held: blocked", () => expectBlocked("ce_rejected", "ce_held"));
});

// ── Part 2: Action tests with mocked DB ─────────────────────────────────────

// Mock tenant context and audit
const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockLogAudit = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: { id: "user-1" },
      tenant: {
        db: {
          customsEntry: {
            create: mockCreate,
            findUnique: mockFindUnique,
            update: mockUpdate,
          },
        },
      },
    })
  ),
}));

jest.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCustomsEntry, updateEntryStatus } = require("@/modules/customs/actions");

describe("createCustomsEntry action", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates an entry and returns the id", async () => {
    mockCreate.mockResolvedValue({ id: "entry-1" });

    const result = await createCustomsEntry({
      entryType: "informal",
      carrier: "Maersk",
    });

    expect(result).toEqual({ id: "entry-1" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: "informal",
          carrier: "Maersk",
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
  });

  it("returns error on validation failure", async () => {
    const result = await createCustomsEntry({ entryType: "" });
    expect(result.error).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error if DB throws", async () => {
    mockCreate.mockRejectedValue(new Error("DB down"));
    const result = await createCustomsEntry({ entryType: "formal" });
    expect(result.error).toBe("DB down");
  });
});

describe("updateEntryStatus action", () => {
  beforeEach(() => jest.clearAllMocks());

  it("transitions from ce_draft to ce_pending", async () => {
    mockFindUnique.mockResolvedValue({ id: "e-1", status: "ce_draft" });
    mockUpdate.mockResolvedValue({ id: "e-1", status: "ce_pending" });

    const result = await updateEntryStatus("e-1", "ce_pending");
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: expect.objectContaining({ status: "ce_pending" }),
      })
    );
  });

  it("sets filedAt when transitioning to ce_filed", async () => {
    mockFindUnique.mockResolvedValue({ id: "e-2", status: "ce_draft" });
    mockUpdate.mockResolvedValue({ id: "e-2", status: "ce_filed" });

    await updateEntryStatus("e-2", "ce_filed");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ce_filed",
          filedAt: expect.any(Date),
        }),
      })
    );
  });

  it("sets clearedAt when transitioning to ce_cleared", async () => {
    mockFindUnique.mockResolvedValue({ id: "e-3", status: "ce_filed" });
    mockUpdate.mockResolvedValue({ id: "e-3", status: "ce_cleared" });

    await updateEntryStatus("e-3", "ce_cleared");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ce_cleared",
          clearedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns error for invalid transition", async () => {
    mockFindUnique.mockResolvedValue({ id: "e-4", status: "ce_cleared" });

    const result = await updateEntryStatus("e-4", "ce_draft");
    expect(result.error).toMatch(/Invalid/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when entry not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateEntryStatus("missing", "ce_pending");
    expect(result.error).toBe("Entry not found");
  });

  it("returns error for invalid status value", async () => {
    const result = await updateEntryStatus("e-5", "bogus_status");
    expect(result.error).toBeDefined();
  });
});
