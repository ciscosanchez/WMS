/**
 * @jest-environment node
 */

import {
  markShipmentShipped,
  mockDb,
  mockTxPrisma,
  resetInventoryIntegrityMocks,
} from "./inventory-integrity/shared";

describe("Transactional inventory integrity", () => {
  beforeEach(() => {
    resetInventoryIntegrityMocks();
  });

  describe("markShipmentShipped", () => {
    const shipmentId = "ship-1";

    const mockShipment = {
      id: shipmentId,
      orderId: "order-1",
      shipmentNumber: "SHP-0001",
      status: "pending",
      order: { id: "order-1", externalId: null },
      items: [
        { id: "si-1", productId: "prod-1", quantity: 5, lotNumber: null, serialNumber: null },
        { id: "si-2", productId: "prod-2", quantity: 3, lotNumber: "LOT-1", serialNumber: null },
      ],
    };

    it("uses $transaction for the entire ship operation", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      });
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999AA10123456784", "UPS");

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("decrements onHand and deallocates for each shipped item", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      });
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999", "UPS");

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            onHand: { decrement: 5 },
            allocated: { decrement: 5 },
            available: 15,
          },
        })
      );

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            onHand: { decrement: 3 },
            allocated: { decrement: 3 },
            available: 7,
          },
        })
      );
    });

    it("writes deallocate ledger entries for each item", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      });
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999", "UPS");

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "deallocate",
            productId: "prod-1",
            fromBinId: "bin-A",
            quantity: 5,
            referenceType: "shipment",
            referenceId: shipmentId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "deallocate",
            productId: "prod-2",
            fromBinId: "bin-B",
            quantity: 3,
            lotNumber: "LOT-1",
            referenceType: "shipment",
            referenceId: shipmentId,
          }),
        })
      );
    });

    it("updates shipment status to shipped inside tx", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({ lines: [] });

      await markShipmentShipped(shipmentId, "TRACK-123", "FedEx");

      expect(mockTxPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shipmentId },
          data: expect.objectContaining({
            trackingNumber: "TRACK-123",
            carrier: "FedEx",
            status: "shipped",
          }),
        })
      );
    });

    it("updates order status to shipped inside tx", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({ lines: [] });

      await markShipmentShipped(shipmentId, "TRACK-123", "FedEx");

      expect(mockTxPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          data: expect.objectContaining({
            status: "shipped",
          }),
        })
      );
    });

    it("rejects shipment when stock is insufficient (prevents negative inventory)", async () => {
      const lowStockShipment = {
        ...mockShipment,
        items: [
          { id: "si-1", productId: "prod-1", quantity: 10, lotNumber: null, serialNumber: null },
        ],
      };
      mockDb.shipment.findUnique.mockResolvedValue(lowStockShipment);

      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [{ productId: "prod-1", binId: "bin-A" }],
      });
      mockTxPrisma.inventory.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        onHand: 3,
        allocated: 2,
        available: 1,
      });

      const result = await markShipmentShipped(shipmentId, "TRACK-X", "USPS");

      expect(result).toEqual({
        error: expect.stringContaining("Insufficient stock"),
      });

      expect(mockTxPrisma.shipment.update).not.toHaveBeenCalled();
      expect(mockTxPrisma.order.update).not.toHaveBeenCalled();
    });

    it("returns error object when shipment not found (no throw)", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(null);

      const result = await markShipmentShipped("nonexistent", "TRK", "UPS");

      expect(result).toEqual({ error: "Shipment not found" });
    });
  });
});
