import {
  inboundShipmentSchemaStatic as inboundShipmentSchema,
  shipmentLineSchemaStatic as shipmentLineSchema,
  receiveLineSchema,
  discrepancySchemaStatic as discrepancySchema,
} from "@/modules/receiving/schemas";

describe("Receiving schemas", () => {
  describe("inboundShipmentSchema", () => {
    it("validates minimal shipment with only clientId", () => {
      const result = inboundShipmentSchema.safeParse({ clientId: "client-1" });
      expect(result.success).toBe(true);
    });

    it("rejects missing clientId", () => {
      const result = inboundShipmentSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects empty clientId", () => {
      const result = inboundShipmentSchema.safeParse({ clientId: "" });
      expect(result.success).toBe(false);
    });

    it("accepts optional fields", () => {
      const result = inboundShipmentSchema.safeParse({
        clientId: "client-1",
        carrier: "FedEx",
        trackingNumber: "1234567890",
        bolNumber: "BOL-001",
        poNumber: "PO-999",
        expectedDate: "2026-04-01",
        notes: "Handle with care",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null optional fields", () => {
      const result = inboundShipmentSchema.safeParse({
        clientId: "client-1",
        carrier: null,
        trackingNumber: null,
        bolNumber: null,
        poNumber: null,
        expectedDate: null,
        notes: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("shipmentLineSchema", () => {
    it("validates a valid shipment line", () => {
      const result = shipmentLineSchema.safeParse({
        productId: "prod-1",
        expectedQty: 10,
      });
      expect(result.success).toBe(true);
    });

    it("defaults uom to EA", () => {
      const result = shipmentLineSchema.safeParse({
        productId: "prod-1",
        expectedQty: 5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uom).toBe("EA");
      }
    });

    it("rejects zero quantity", () => {
      const result = shipmentLineSchema.safeParse({
        productId: "prod-1",
        expectedQty: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative quantity", () => {
      const result = shipmentLineSchema.safeParse({
        productId: "prod-1",
        expectedQty: -5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing productId", () => {
      const result = shipmentLineSchema.safeParse({
        expectedQty: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("receiveLineSchema", () => {
    it("validates a valid receive line", () => {
      const result = receiveLineSchema.safeParse({
        lineId: "line-1",
        quantity: 5,
        condition: "good",
      });
      expect(result.success).toBe(true);
    });

    it("accepts damaged condition", () => {
      const result = receiveLineSchema.safeParse({
        lineId: "line-1",
        quantity: 1,
        condition: "damaged",
      });
      expect(result.success).toBe(true);
    });

    it("accepts quarantine condition", () => {
      const result = receiveLineSchema.safeParse({
        lineId: "line-1",
        quantity: 1,
        condition: "quarantine",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid condition", () => {
      const result = receiveLineSchema.safeParse({
        lineId: "line-1",
        quantity: 1,
        condition: "broken",
      });
      expect(result.success).toBe(false);
    });

    it("defaults condition to good", () => {
      const result = receiveLineSchema.safeParse({
        lineId: "line-1",
        quantity: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.condition).toBe("good");
      }
    });
  });

  describe("discrepancySchema", () => {
    it("validates a valid shortage discrepancy", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "shortage",
        description: "Missing 5 units of SKU-001",
      });
      expect(result.success).toBe(true);
    });

    it("validates an overage discrepancy", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "overage",
        description: "Received 10 extra units",
      });
      expect(result.success).toBe(true);
    });

    it("validates a damage discrepancy", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "damage",
        description: "Box crushed",
        productId: "prod-1",
        expectedQty: 10,
        actualQty: 7,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "lost",
        description: "Items lost",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing description", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "shortage",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty description", () => {
      const result = discrepancySchema.safeParse({
        shipmentId: "ship-1",
        type: "shortage",
        description: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
