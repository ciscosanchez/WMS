/**
 * @jest-environment node
 */

import {
  approveAdjustment,
  mockDb,
  mockTxPrisma,
  resetInventoryIntegrityMocks,
} from "./inventory-integrity/shared";

describe("Transactional inventory integrity", () => {
  beforeEach(() => {
    resetInventoryIntegrityMocks();
  });

  describe("approveAdjustment", () => {
    const adjustmentId = "adj-1";

    const mockAdjustment = {
      id: adjustmentId,
      status: "pending_approval",
      reason: "Cycle count variance",
      lines: [
        {
          id: "line-1",
          productId: "prod-1",
          binId: "bin-A",
          lotNumber: null,
          serialNumber: null,
          systemQty: 100,
          countedQty: 95,
          variance: -5,
        },
        {
          id: "line-2",
          productId: "prod-2",
          binId: "bin-B",
          lotNumber: "LOT-42",
          serialNumber: null,
          systemQty: 0,
          countedQty: 10,
          variance: 10,
        },
      ],
    };

    it("uses $transaction for the entire approval", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        allocated: 5,
      });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("applies correct onHand = countedQty and available = countedQty - allocated", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", allocated: 5 })
        .mockResolvedValueOnce(null);

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: { onHand: 95, available: 90 },
        })
      );

      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-2",
            binId: "bin-B",
            onHand: 10,
            allocated: 0,
            available: 10,
          }),
        })
      );
    });

    it("marks adjustment as completed atomically inside the tx", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({ id: "inv-1", allocated: 0 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockTxPrisma.inventoryAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adjustmentId },
          data: expect.objectContaining({
            status: "completed",
            approvedBy: "user-1",
          }),
        })
      );
    });

    it("writes a ledger entry for each adjustment line", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({ id: "inv-1", allocated: 0 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(2);

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "adjust",
            productId: "prod-1",
            quantity: -5,
            referenceType: "adjustment",
            referenceId: adjustmentId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "adjust",
            productId: "prod-2",
            quantity: 10,
            referenceType: "adjustment",
            referenceId: adjustmentId,
          }),
        })
      );
    });

    it("is idempotent — skips if adjustment already completed", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue({
        ...mockAdjustment,
        status: "completed",
      });

      await approveAdjustment(adjustmentId);

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("is idempotent inside tx — skips if status flipped concurrently", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "completed" });

      await approveAdjustment(adjustmentId);

      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalled();
      expect(mockTxPrisma.inventory.create).not.toHaveBeenCalled();
      expect(mockTxPrisma.inventoryAdjustment.update).not.toHaveBeenCalled();
    });
  });
});
