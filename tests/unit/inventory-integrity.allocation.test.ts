/**
 * @jest-environment node
 */

import {
  mockDb,
  mockTxPrisma,
  resetInventoryIntegrityMocks,
  updateOrderStatus,
} from "./inventory-integrity/shared";

describe("Transactional inventory integrity", () => {
  beforeEach(() => {
    resetInventoryIntegrityMocks();
  });

  describe("generatePickTasksForOrder (via updateOrderStatus to picking)", () => {
    const orderId = "order-1";
    const existingOrder = {
      id: orderId,
      status: "allocated",
      orderNumber: "ORD-0001",
      shipToName: "Customer",
      shipToAddress1: "123 Main",
      shipToCity: "Dallas",
      shipToState: "TX",
      shipToZip: "75201",
      lines: [
        {
          id: "ol-1",
          productId: "prod-1",
          quantity: 5,
          product: { sku: "SKU-1", name: "Widget", weight: 1 },
        },
        {
          id: "ol-2",
          productId: "prod-2",
          quantity: 3,
          product: { sku: "SKU-2", name: "Gadget", weight: 2 },
        },
      ],
    };

    it("uses $transaction for inventory allocation", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("increments allocated and decrements available for each line", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            allocated: { increment: 5 },
            available: { decrement: 5 },
          },
        })
      );

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            allocated: { increment: 3 },
            available: { decrement: 3 },
          },
        })
      );
    });

    it("writes allocation ledger entries for each line", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "allocate",
            productId: "prod-1",
            fromBinId: "bin-A",
            quantity: 5,
            referenceType: "order",
            referenceId: orderId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "allocate",
            productId: "prod-2",
            fromBinId: "bin-B",
            quantity: 3,
            referenceType: "order",
            referenceId: orderId,
          }),
        })
      );
    });

    it("skips allocation when no bin has enough stock (no crash)", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.pickTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId,
            status: "pending",
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({ productId: "prod-1", binId: null, quantity: 5 }),
                expect.objectContaining({ productId: "prod-2", binId: null, quantity: 3 }),
              ]),
            },
          }),
        })
      );

      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalled();
    });

    it("prefers inventory records whose propagated attributes match order-line criteria", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        ...existingOrder,
        lines: [existingOrder.lines[0]],
      });
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.operationalAttributeValue.findMany
        .mockResolvedValueOnce([
          {
            definition: { key: "room_reference" },
            textValue: "living_room",
            numberValue: null,
            booleanValue: null,
            dateValue: null,
            jsonValue: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            definition: { key: "room_reference" },
            textValue: "primary_bedroom",
            numberValue: null,
            booleanValue: null,
            dateValue: null,
            jsonValue: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            definition: { key: "room_reference" },
            textValue: "living_room",
            numberValue: null,
            booleanValue: null,
            dateValue: null,
            jsonValue: null,
          },
        ]);

      mockTxPrisma.operationalAttributeDefinition.findMany.mockResolvedValue([
        { id: "inv-room-reference", key: "room_reference" },
      ]);

      mockTxPrisma.inventory.findMany.mockResolvedValue([{ id: "inv-2", binId: "bin-B" }, { id: "inv-1", binId: "bin-A" }]);
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
        })
      );
      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
        })
      );
    });
  });
});
