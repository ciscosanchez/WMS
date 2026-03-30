/**
 * @jest-environment node
 *
 * Tests for order CSV import:
 * parseOrderCsv — grouping, validation, quoted fields, empty lines
 */

import { parseOrderCsv } from "@/modules/orders/import-actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("parseOrderCsv", () => {
  const HEADER =
    "clientCode,shipToName,shipToAddress1,shipToCity,shipToZip,sku,quantity";

  // ── Grouping ──────────────────────────────────────────────────────────────

  describe("grouping rows into orders", () => {
    it("groups rows by clientCode + shipToName + shipToAddress1", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5",
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-2,3",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(1);
      expect(orders[0].clientCode).toBe("ACME");
      expect(orders[0].lines).toHaveLength(2);
      expect(orders[0].lines[0].sku).toBe("SKU-1");
      expect(orders[0].lines[1].sku).toBe("SKU-2");
    });

    it("creates separate orders for different ship-to addresses", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5",
        "ACME,Jane Doe,456 Oak Ave,Austin,73301,SKU-2,3",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(2);
    });

    it("creates separate orders for different clients at same address", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5",
        "GLOBEX,John Doe,123 Main St,Dallas,75201,SKU-2,3",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(2);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validates required fields", () => {
    it("reports error for missing clientCode", () => {
      const csv = [
        HEADER,
        ",John Doe,123 Main St,Dallas,75201,SKU-1,5",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].row).toBe(2);
      expect(errors[0].message).toContain("clientCode");
      expect(orders).toHaveLength(0);
    });

    it("reports error for missing sku", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,,5",
      ].join("\n");

      const { errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("sku");
    });

    it("reports error for non-numeric quantity", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,abc",
      ].join("\n");

      const { errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("quantity");
    });

    it("reports error for zero quantity", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,0",
      ].join("\n");

      const { errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("quantity");
    });

    it("reports error for missing required columns", () => {
      const csv = [
        HEADER,
        "ACME,,123 Main St,Dallas,75201,SKU-1,5",
      ].join("\n");

      const { errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("shipToName");
    });

    it("reports multiple errors for multiple invalid rows", () => {
      const csv = [
        HEADER,
        ",John Doe,123 Main St,Dallas,75201,SKU-1,5",
        "ACME,,123 Main St,Dallas,75201,SKU-2,3",
      ].join("\n");

      const { errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(2);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("handles edge cases", () => {
    it("handles quoted CSV fields with commas", () => {
      const csv = [
        HEADER,
        'ACME,"Doe, John","123 Main St, Apt 4",Dallas,75201,SKU-1,5',
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(1);
      expect(orders[0].shipToName).toBe("Doe, John");
      expect(orders[0].shipToAddress1).toBe("123 Main St, Apt 4");
    });

    it("handles quoted fields with escaped quotes", () => {
      const csv = [
        HEADER,
        'ACME,"John ""JD"" Doe",123 Main St,Dallas,75201,SKU-1,5',
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders[0].shipToName).toBe('John "JD" Doe');
    });

    it("skips empty lines in CSV", () => {
      const csv = [
        HEADER,
        "",
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5",
        "",
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-2,3",
        "",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(1);
      expect(orders[0].lines).toHaveLength(2);
    });

    it("returns error for CSV with only header", () => {
      const csv = HEADER;

      const { orders, errors } = parseOrderCsv(csv);

      expect(orders).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("at least one data row");
    });

    it("returns error for empty CSV", () => {
      const { orders, errors } = parseOrderCsv("");

      expect(orders).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    it("handles optional fields with defaults", () => {
      const headerFull =
        "clientCode,shipToName,shipToAddress1,shipToCity,shipToZip,sku,quantity,priority,uom,lotNumber";
      const csv = [
        headerFull,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5,expedited,CS,LOT-42",
      ].join("\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders[0].priority).toBe("expedited");
      expect(orders[0].lines[0].uom).toBe("CS");
      expect(orders[0].lines[0].lotNumber).toBe("LOT-42");
    });

    it("handles Windows-style line endings (CRLF)", () => {
      const csv = [
        HEADER,
        "ACME,John Doe,123 Main St,Dallas,75201,SKU-1,5",
      ].join("\r\n");

      const { orders, errors } = parseOrderCsv(csv);

      expect(errors).toHaveLength(0);
      expect(orders).toHaveLength(1);
    });
  });
});
