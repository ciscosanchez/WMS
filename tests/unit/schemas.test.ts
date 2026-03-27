import { clientSchemaStatic as clientSchema } from "@/modules/clients/schemas";
import { orderSchemaStatic as orderSchema } from "@/modules/orders/schemas";
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
        unitsPerCase: 24,
        caseBarcode: "1234567890123",
        uomConversions: [{ fromUom: "CS", toUom: "EA", factor: 24 }],
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

    it("rejects duplicate conversion rows", () => {
      const result = productSchema.safeParse({
        clientId: "client-1",
        sku: "WIDGET-002",
        name: "Configured Widget",
        baseUom: "EA",
        uomConversions: [
          { fromUom: "CS", toUom: "EA", factor: 24 },
          { fromUom: "CS", toUom: "EA", factor: 12 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects conversions that do not resolve to the base UOM", () => {
      const result = productSchema.safeParse({
        clientId: "client-1",
        sku: "WIDGET-003",
        name: "Configured Widget",
        baseUom: "EA",
        uomConversions: [{ fromUom: "PLT", toUom: "CS", factor: 40 }],
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

  describe("orderSchema", () => {
    it("normalizes shipping contact fields", () => {
      const result = orderSchema.safeParse({
        clientId: "client-1",
        shipToName: "  Jane Cooper  ",
        shipToAddress1: "  123 Main St  ",
        shipToCity: "  Austin ",
        shipToState: " tx ",
        shipToZip: " 78701 ",
        shipToCountry: "us",
        shipToPhone: " (512) 555-0100 ",
        shipToEmail: " JANE@EXAMPLE.COM ",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.shipToName).toBe("Jane Cooper");
      expect(result.data.shipToState).toBe("TX");
      expect(result.data.shipToCountry).toBe("US");
      expect(result.data.shipToPhone).toBe("5125550100");
      expect(result.data.shipToEmail).toBe("jane@example.com");
    });

    it("rejects unsupported country and invalid region combinations", () => {
      const result = orderSchema.safeParse({
        clientId: "client-1",
        shipToName: "Jane Cooper",
        shipToAddress1: "123 Main St",
        shipToCity: "Austin",
        shipToState: "ON",
        shipToZip: "78701",
        shipToCountry: "US",
      });

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
