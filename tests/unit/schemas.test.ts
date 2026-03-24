import { clientSchemaStatic as clientSchema } from "@/modules/clients/schemas";
import { productSchemaStatic as productSchema } from "@/modules/products/schemas";
import { inboundShipmentSchemaStatic as inboundShipmentSchema } from "@/modules/receiving/schemas";
import { moveInventorySchema } from "@/modules/inventory/schemas";

describe("Zod schemas", () => {
  describe("clientSchema", () => {
    it("validates a valid client", () => {
      const result = clientSchema.safeParse({
        code: "ACME",
        name: "Acme Corporation",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing code", () => {
      const result = clientSchema.safeParse({
        name: "Acme Corporation",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = clientSchema.safeParse({
        code: "ACME",
        name: "",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional fields as null", () => {
      const result = clientSchema.safeParse({
        code: "TEST",
        name: "Test Client",
        isActive: true,
        contactName: null,
        contactEmail: null,
        city: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("productSchema", () => {
    it("validates a valid product", () => {
      const result = productSchema.safeParse({
        clientId: "client-1",
        sku: "WIDGET-001",
        name: "Standard Widget",
        baseUom: "EA",
        weightUnit: "lb",
        dimUnit: "in",
        trackLot: false,
        trackSerial: false,
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing SKU", () => {
      const result = productSchema.safeParse({
        clientId: "client-1",
        name: "Widget",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("inboundShipmentSchema", () => {
    it("validates minimal shipment", () => {
      const result = inboundShipmentSchema.safeParse({
        clientId: "client-1",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing clientId", () => {
      const result = inboundShipmentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

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
  });
});
