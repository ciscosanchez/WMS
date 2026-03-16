import {
  moveInventorySchema,
  adjustmentSchema,
  adjustmentLineSchema,
} from "@/modules/inventory/schemas";

describe("Inventory schemas", () => {
  describe("moveInventorySchema", () => {
    it("validates a valid move", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "bin-2",
        quantity: 10,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero quantity", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "bin-2",
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative quantity", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "bin-2",
        quantity: -5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing productId", () => {
      const result = moveInventorySchema.safeParse({
        fromBinId: "bin-1",
        toBinId: "bin-2",
        quantity: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty fromBinId", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "",
        toBinId: "bin-2",
        quantity: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty toBinId", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "",
        quantity: 10,
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional lot and serial numbers", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "bin-2",
        quantity: 5,
        lotNumber: "LOT-001",
        serialNumber: "SN-001",
        reason: "Reorganization",
      });
      expect(result.success).toBe(true);
    });

    it("accepts same from/to bin (schema does not prevent it)", () => {
      const result = moveInventorySchema.safeParse({
        productId: "prod-1",
        fromBinId: "bin-1",
        toBinId: "bin-1",
        quantity: 5,
      });
      // The Zod schema itself doesn't enforce from !== to — that's business logic
      expect(result.success).toBe(true);
    });
  });

  describe("adjustmentSchema", () => {
    it("validates adjustment type", () => {
      const result = adjustmentSchema.safeParse({
        type: "adjustment",
        reason: "Damaged goods",
      });
      expect(result.success).toBe(true);
    });

    it("validates cycle_count type", () => {
      const result = adjustmentSchema.safeParse({
        type: "cycle_count",
        notes: "Monthly count",
      });
      expect(result.success).toBe(true);
    });

    it("defaults type to adjustment", () => {
      const result = adjustmentSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("adjustment");
      }
    });

    it("rejects invalid type", () => {
      const result = adjustmentSchema.safeParse({
        type: "write_off",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("adjustmentLineSchema", () => {
    it("validates a valid adjustment line", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        binId: "bin-1",
        systemQty: 100,
        countedQty: 98,
      });
      expect(result.success).toBe(true);
    });

    it("accepts zero countedQty", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        binId: "bin-1",
        systemQty: 10,
        countedQty: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative countedQty", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        binId: "bin-1",
        systemQty: 10,
        countedQty: -1,
      });
      expect(result.success).toBe(false);
    });

    it("allows negative systemQty (system could be wrong)", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        binId: "bin-1",
        systemQty: -5,
        countedQty: 0,
      });
      // systemQty has no .min() constraint — it just records what the system says
      expect(result.success).toBe(true);
    });

    it("rejects missing productId", () => {
      const result = adjustmentLineSchema.safeParse({
        binId: "bin-1",
        systemQty: 10,
        countedQty: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing binId", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        systemQty: 10,
        countedQty: 10,
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional lot and serial numbers", () => {
      const result = adjustmentLineSchema.safeParse({
        productId: "prod-1",
        binId: "bin-1",
        systemQty: 10,
        countedQty: 10,
        lotNumber: "LOT-A",
        serialNumber: null,
        notes: "All accounted for",
      });
      expect(result.success).toBe(true);
    });
  });
});
