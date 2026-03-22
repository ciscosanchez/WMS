/**
 * Tests for offline queue IndexedDB operations.
 *
 * Uses a fake-indexeddb polyfill since Jest runs in Node.
 */

// Polyfill structuredClone for Node <17 test environments
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = <T>(val: T): T => JSON.parse(JSON.stringify(val));
}

import "fake-indexeddb/auto";
import {
  enqueueAction,
  getPendingActions,
  removeAction,
  incrementRetry,
  clearQueue,
  getQueueSize,
} from "@/lib/offline-queue";

// Reset IndexedDB between tests
beforeEach(async () => {
  await clearQueue();
});

describe("offline-queue", () => {
  it("enqueues an action and retrieves it", async () => {
    await enqueueAction("operator:confirmPickLine", ["line-1", 5]);

    const actions = await getPendingActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("operator:confirmPickLine");
    expect(actions[0].args).toEqual(["line-1", 5]);
    expect(actions[0].retries).toBe(0);
    expect(actions[0].timestamp).toBeGreaterThan(0);
  });

  it("enqueues multiple actions in FIFO order", async () => {
    await enqueueAction("a", [1]);
    await enqueueAction("b", [2]);
    await enqueueAction("c", [3]);

    const actions = await getPendingActions();
    expect(actions.map((a) => a.action)).toEqual(["a", "b", "c"]);
  });

  it("removes a specific action by id", async () => {
    await enqueueAction("a", [1]);
    await enqueueAction("b", [2]);

    const before = await getPendingActions();
    expect(before).toHaveLength(2);

    await removeAction(before[0].id!);
    const after = await getPendingActions();
    expect(after).toHaveLength(1);
    expect(after[0].action).toBe("b");
  });

  it("increments retry count", async () => {
    await enqueueAction("a", [1]);
    const [action] = await getPendingActions();
    expect(action.retries).toBe(0);

    await incrementRetry(action.id!);
    const [updated] = await getPendingActions();
    expect(updated.retries).toBe(1);

    await incrementRetry(action.id!);
    const [updated2] = await getPendingActions();
    expect(updated2.retries).toBe(2);
  });

  it("clearQueue removes all actions", async () => {
    await enqueueAction("a", [1]);
    await enqueueAction("b", [2]);
    await enqueueAction("c", [3]);

    expect(await getQueueSize()).toBe(3);

    await clearQueue();
    expect(await getQueueSize()).toBe(0);
    expect(await getPendingActions()).toEqual([]);
  });

  it("getQueueSize returns accurate count", async () => {
    expect(await getQueueSize()).toBe(0);

    await enqueueAction("a", [1]);
    expect(await getQueueSize()).toBe(1);

    await enqueueAction("b", [2]);
    expect(await getQueueSize()).toBe(2);

    const [first] = await getPendingActions();
    await removeAction(first.id!);
    expect(await getQueueSize()).toBe(1);
  });

  it("preserves complex args through serialization", async () => {
    const complexArgs = [
      "shipment-123",
      {
        lineId: "line-456",
        binId: "bin-789",
        quantity: 42,
        condition: "good",
      },
    ];

    await enqueueAction("receiving:receiveLine", complexArgs);
    const [action] = await getPendingActions();
    expect(action.args).toEqual(complexArgs);
  });
});
