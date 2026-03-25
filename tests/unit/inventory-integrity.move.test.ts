/**
 * @jest-environment node
 */

import {
  mockDb,
  mockTxPrisma,
  moveInventory,
  resetInventoryIntegrityMocks,
} from "./inventory-integrity/shared";

describe("Transactional inventory integrity", () => {
  beforeEach(() => {
    resetInventoryIntegrityMocks();
  });

  describe("moveInventory", () => {
    const moveData = {
      productId: "prod-1",
      fromBinId: "bin-A",
      toBinId: "bin-B",
      quantity: 10,
    };

    it("uses $transaction for the entire move", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 })
        .mockResolvedValueOnce({ id: "inv-2" });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it("decrements source and increments destination inside tx", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 })
        .mockResolvedValueOnce({ id: "inv-2" });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            onHand: { decrement: 10 },
            available: { decrement: 10 },
          },
        })
      );

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            onHand: { increment: 10 },
            available: { increment: 10 },
          },
        })
      );
    });

    it("creates destination inventory when bin is empty", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 20,
        allocated: 0,
        available: 20,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 20 })
        .mockResolvedValueOnce(null);

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({ id: "inv-new" });
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-1",
            binId: "bin-B",
            onHand: 10,
            allocated: 0,
            available: 10,
          }),
        })
      );
    });

    it("writes a ledger entry inside tx", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 })
        .mockResolvedValueOnce(null);

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "move",
            productId: "prod-1",
            fromBinId: "bin-A",
            toBinId: "bin-B",
            quantity: 10,
            performedBy: "user-1",
          }),
        })
      );
    });

    it("throws when source has insufficient available stock (pre-tx check)", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 5,
        allocated: 0,
        available: 5,
      });

      await expect(moveInventory(moveData)).rejects.toThrow("Insufficient available inventory");

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("throws when source not found at all", async () => {
      mockDb.inventory.findFirst.mockResolvedValue(null);

      await expect(moveInventory(moveData)).rejects.toThrow("Insufficient available inventory");

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("throws on concurrent modification (in-tx re-validation)", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      mockTxPrisma.inventory.findFirst.mockResolvedValueOnce(null);

      await expect(moveInventory(moveData)).rejects.toThrow(
        "Insufficient available inventory (concurrent modification)"
      );
    });
  });
});
