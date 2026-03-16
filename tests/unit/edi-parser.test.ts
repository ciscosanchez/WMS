import { parseEDI, parse940 } from "@/lib/integrations/edi/parser";
import { generate945 } from "@/lib/integrations/edi/generator";
import type { EDI945Data } from "@/lib/integrations/edi/types";

// ---------------------------------------------------------------------------
// Sample EDI 940 document — Warehouse Shipping Order
// ---------------------------------------------------------------------------

const SAMPLE_940 = [
  "ISA*00*          *00*          *ZZ*ACMECORP       *ZZ*WAREHOUSE      *260315*1430*U*00401*000000123*0*P*:~",
  "GS*OW*ACMECORP*WAREHOUSE*20260315*1430*1*X*004010~",
  "ST*940*0001~",
  "W05*N*ORD-2026-001*DEP-5001*PO-88812~",
  "N1*ST*John Smith~",
  "N3*742 Evergreen Terrace~",
  "N4*Springfield*IL*62704*US~",
  "G62*10*20260320~",
  "TD5*O*2*UPSN**GROUND~",
  "NTE*GEN*Handle with care~",
  "W04*10*EA*SK*SKU-WIDGET-A~",
  "W04*5*CS*UP*012345678901*LOT-2026A~",
  "SE*11*0001~",
  "GE*1*1~",
  "IEA*1*000000123~",
].join("\n");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EDI Parser", () => {
  describe("parseEDI — envelope parsing", () => {
    it("extracts ISA segment with sender and receiver IDs", () => {
      const doc = parseEDI(SAMPLE_940);

      expect(doc.isa).not.toBeNull();
      expect(doc.isa!.id).toBe("ISA");
      // ISA06 = sender ID (padded to 15 chars)
      expect(doc.isa!.elements[5]).toContain("ACMECORP");
      // ISA08 = receiver ID
      expect(doc.isa!.elements[7]).toContain("WAREHOUSE");
    });

    it("extracts GS functional group header", () => {
      const doc = parseEDI(SAMPLE_940);

      expect(doc.gs).not.toBeNull();
      expect(doc.gs!.id).toBe("GS");
      // GS01 = Functional Identifier Code (OW = outbound warehouse order)
      expect(doc.gs!.elements[0]).toBe("OW");
    });

    it("detects correct separators", () => {
      const doc = parseEDI(SAMPLE_940);

      expect(doc.separators.element).toBe("*");
      expect(doc.separators.subElement).toBe(":");
      expect(doc.separators.segment).toBe("~");
    });

    it("extracts the correct number of transaction sets", () => {
      const doc = parseEDI(SAMPLE_940);

      expect(doc.transactionSets).toHaveLength(1);
      expect(doc.transactionSets[0].type).toBe("940");
    });

    it("extracts IEA and GE trailers", () => {
      const doc = parseEDI(SAMPLE_940);

      expect(doc.iea).not.toBeNull();
      expect(doc.iea!.elements[0]).toBe("1"); // 1 functional group
      expect(doc.ge).not.toBeNull();
      expect(doc.ge!.elements[0]).toBe("1"); // 1 transaction set
    });
  });

  describe("parse940 — Warehouse Shipping Order", () => {
    it("parses header fields from W05 segment", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data!.header.orderNumber).toBe("ORD-2026-001");
      expect(result.data!.header.depositorOrderNumber).toBe("DEP-5001");
      expect(result.data!.header.purchaseOrderNumber).toBe("PO-88812");
    });

    it("parses ship-to address from N1/N3/N4 segments", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.data!.header.shipToName).toBe("John Smith");
      expect(result.data!.header.shipToAddress.street1).toBe("742 Evergreen Terrace");
      expect(result.data!.header.shipToAddress.city).toBe("Springfield");
      expect(result.data!.header.shipToAddress.state).toBe("IL");
      expect(result.data!.header.shipToAddress.zip).toBe("62704");
    });

    it("parses carrier and shipping method from TD5", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.data!.header.carrierCode).toBe("UPSN");
      expect(result.data!.header.shippingMethod).toBe("GROUND");
    });

    it("parses requested ship date from G62", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.data!.header.requestedShipDate).toBe("20260320");
    });

    it("parses notes from NTE segment", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.data!.header.notes).toBe("Handle with care");
    });

    it("parses line items from W04 segments", () => {
      const doc = parseEDI(SAMPLE_940);
      const result = parse940(doc.transactionSets[0].segments);

      expect(result.data!.lineItems).toHaveLength(2);

      const item1 = result.data!.lineItems[0];
      expect(item1.lineNumber).toBe(1);
      expect(item1.quantityOrdered).toBe(10);
      expect(item1.unitOfMeasure).toBe("EA");
      expect(item1.itemQualifier).toBe("SK");
      expect(item1.itemNumber).toBe("SKU-WIDGET-A");
      expect(item1.lotNumber).toBeUndefined();

      const item2 = result.data!.lineItems[1];
      expect(item2.lineNumber).toBe(2);
      expect(item2.quantityOrdered).toBe(5);
      expect(item2.unitOfMeasure).toBe("CS");
      expect(item2.itemQualifier).toBe("UP");
      expect(item2.itemNumber).toBe("012345678901");
      expect(item2.lotNumber).toBe("LOT-2026A");
    });
  });

  describe("handle malformed EDI gracefully", () => {
    it("returns empty document for empty input", () => {
      const doc = parseEDI("");

      expect(doc.isa).toBeNull();
      expect(doc.gs).toBeNull();
      expect(doc.transactionSets).toHaveLength(0);
    });

    it("returns default separators for non-ISA input", () => {
      const doc = parseEDI("NOT*AN*EDI*DOCUMENT~");

      expect(doc.separators.element).toBe("*");
      expect(doc.separators.segment).toBe("~");
    });

    it("parse940 fails gracefully when W05 is missing", () => {
      const doc = parseEDI(
        [
          "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260101*1200*U*00401*000000001*0*P*:~",
          "GS*OW*SENDER*RECEIVER*20260101*1200*1*X*004010~",
          "ST*940*0001~",
          "NTE*GEN*Some note~",
          "SE*3*0001~",
          "GE*1*1~",
          "IEA*1*000000001~",
        ].join("\n")
      );

      const result = parse940(doc.transactionSets[0].segments);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing W05 (Shipping Order Identification) segment");
    });

    it("handles segments with missing elements without crashing", () => {
      const doc = parseEDI(
        [
          "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260101*1200*U*00401*000000001*0*P*:~",
          "GS*OW*SENDER*RECEIVER*20260101*1200*1*X*004010~",
          "ST*940*0001~",
          "W05*N*ORD-001~",
          "W04*10~",
          "SE*4*0001~",
          "GE*1*1~",
          "IEA*1*000000001~",
        ].join("\n")
      );

      const result = parse940(doc.transactionSets[0].segments);
      // Should still parse, filling in defaults for missing fields
      expect(result.success).toBe(true);
      expect(result.data!.lineItems[0].unitOfMeasure).toBe("EA");
      expect(result.data!.lineItems[0].itemQualifier).toBe("SK");
    });
  });
});

describe("EDI 945 Generator", () => {
  it("generates a valid EDI 945 with correct envelope structure", () => {
    const data: EDI945Data = {
      senderId: "WAREHOUSE",
      receiverId: "ACMECORP",
      controlNumber: "000000456",
      groupControlNumber: "1",
      transactionControlNumber: "0001",
      header: {
        shipmentId: "SHP-2026-100",
        orderNumber: "ORD-2026-001",
        depositorOrderNumber: "DEP-5001",
        shipDate: "20260316",
        trackingNumber: "1Z999AA10123456784",
        carrierCode: "UPSN",
        bolNumber: "BOL-12345",
        totalWeight: 25,
        totalPackages: 2,
      },
      lineItems: [
        {
          lineNumber: 1,
          itemNumber: "SKU-WIDGET-A",
          itemQualifier: "SK",
          quantityShipped: 10,
          unitOfMeasure: "EA",
        },
        {
          lineNumber: 2,
          itemNumber: "012345678901",
          itemQualifier: "UP",
          quantityShipped: 5,
          unitOfMeasure: "CS",
          lotNumber: "LOT-2026A",
        },
      ],
    };

    const edi = generate945(data);

    // Verify ISA envelope
    expect(edi).toContain("ISA*");
    expect(edi).toContain("WAREHOUSE");
    expect(edi).toContain("ACMECORP");

    // Verify GS functional group header (SW = Warehouse Shipping Advice)
    expect(edi).toContain("GS*SW*");

    // Verify ST transaction set header
    expect(edi).toContain("ST*945*0001~");

    // Verify W06 shipment identification
    expect(edi).toContain("W06*SHP-2026-100*DEP-5001*ORD-2026-001*20260316~");

    // Verify tracking number reference
    expect(edi).toContain("N9*CN*1Z999AA10123456784~");

    // Verify BOL reference
    expect(edi).toContain("N9*BM*BOL-12345~");

    // Verify line items (W12 segments)
    expect(edi).toContain("W12*10*EA***SK*SKU-WIDGET-A**~");
    expect(edi).toContain("W12*5*CS***UP*012345678901*LOT-2026A*~");

    // Verify total shipment info
    expect(edi).toContain("W03*2*25*LB~");

    // Verify SE trailer exists
    expect(edi).toContain("SE*");

    // Verify GE and IEA trailers
    expect(edi).toContain("GE*1*1~");
    expect(edi).toContain("IEA*1*000000456~");
  });

  it("generates a minimal 945 without optional fields", () => {
    const data: EDI945Data = {
      senderId: "WH",
      receiverId: "CUST",
      controlNumber: "1",
      groupControlNumber: "1",
      transactionControlNumber: "1",
      header: {
        shipmentId: "SHP-001",
        orderNumber: "ORD-001",
        depositorOrderNumber: "DEP-001",
        shipDate: "20260316",
      },
      lineItems: [
        {
          lineNumber: 1,
          itemNumber: "ITEM-1",
          itemQualifier: "SK",
          quantityShipped: 1,
          unitOfMeasure: "EA",
        },
      ],
    };

    const edi = generate945(data);

    // Should not contain tracking or BOL references
    expect(edi).not.toContain("N9*CN*");
    expect(edi).not.toContain("N9*BM*");

    // Should still have valid envelope
    expect(edi).toContain("ISA*");
    expect(edi).toContain("ST*945*");
    expect(edi).toContain("SE*");
    expect(edi).toContain("IEA*");
  });
});
