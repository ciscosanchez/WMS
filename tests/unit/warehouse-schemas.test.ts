import { warehouseSchemaStatic as warehouseSchema, bulkLocationSchema } from "@/modules/warehouse/schemas";

describe("Warehouse schemas", () => {
  describe("warehouseSchema", () => {
    it("validates a valid warehouse", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        name: "Main Warehouse",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing code", () => {
      const result = warehouseSchema.safeParse({
        name: "Main Warehouse",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty code", () => {
      const result = warehouseSchema.safeParse({
        code: "",
        name: "Main Warehouse",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        name: "",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("defaults isActive to true", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        name: "Main Warehouse",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("accepts optional address", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        name: "Main Warehouse",
        address: "100 Industrial Blvd, Houston, TX 77001",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null address", () => {
      const result = warehouseSchema.safeParse({
        code: "WH1",
        name: "Main Warehouse",
        address: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("bulkLocationSchema", () => {
    const validBulk = {
      warehouseId: "wh-1",
      zoneCode: "A",
      zoneName: "Zone A",
      zoneType: "storage" as const,
      aisles: 5,
      racksPerAisle: 10,
      shelvesPerRack: 4,
      binsPerShelf: 3,
      binType: "standard" as const,
    };

    it("validates a valid bulk location config", () => {
      const result = bulkLocationSchema.safeParse(validBulk);
      expect(result.success).toBe(true);
    });

    it("rejects aisles below min (0)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, aisles: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects aisles above max (101)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, aisles: 101 });
      expect(result.success).toBe(false);
    });

    it("accepts aisles at min boundary (1)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, aisles: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts aisles at max boundary (100)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, aisles: 100 });
      expect(result.success).toBe(true);
    });

    it("rejects racksPerAisle below min (0)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, racksPerAisle: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects racksPerAisle above max (101)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, racksPerAisle: 101 });
      expect(result.success).toBe(false);
    });

    it("rejects shelvesPerRack below min (0)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, shelvesPerRack: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects shelvesPerRack above max (21)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, shelvesPerRack: 21 });
      expect(result.success).toBe(false);
    });

    it("rejects binsPerShelf below min (0)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, binsPerShelf: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects binsPerShelf above max (51)", () => {
      const result = bulkLocationSchema.safeParse({ ...validBulk, binsPerShelf: 51 });
      expect(result.success).toBe(false);
    });
  });
});
