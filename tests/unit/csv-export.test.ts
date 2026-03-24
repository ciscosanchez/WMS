/**
 * @jest-environment node
 *
 * Tests for CSV export utility.
 */

import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";

describe("generateCsv", () => {
  const columns: ExportColumn[] = [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Product Name" },
    { key: "qty", header: "Quantity" },
  ];

  it("generates header row from columns", () => {
    const csv = generateCsv([], columns);
    expect(csv).toBe("SKU,Product Name,Quantity");
  });

  it("generates data rows", () => {
    const rows = [
      { sku: "A-001", name: "Widget", qty: 10 },
      { sku: "B-002", name: "Gadget", qty: 5 },
    ];
    const csv = generateCsv(rows, columns);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("A-001,Widget,10");
    expect(lines[2]).toBe("B-002,Gadget,5");
  });

  it("escapes cells with commas", () => {
    const rows = [{ sku: "A,B", name: "Test", qty: 1 }];
    const csv = generateCsv(rows, columns);
    expect(csv).toContain('"A,B"');
  });

  it("escapes cells with quotes", () => {
    const rows = [{ sku: 'A"B', name: "Test", qty: 1 }];
    const csv = generateCsv(rows, columns);
    expect(csv).toContain('"A""B"');
  });

  it("handles null/undefined values as empty string", () => {
    const rows = [{ sku: "A", name: null, qty: undefined }];
    const csv = generateCsv(rows as Record<string, unknown>[], columns);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("A,,");
  });

  it("applies format function when provided", () => {
    const cols: ExportColumn[] = [
      { key: "date", header: "Date", format: (v) => String(v).slice(0, 10) },
    ];
    const rows = [{ date: "2026-03-24T12:00:00Z" }];
    const csv = generateCsv(rows, cols);
    expect(csv).toContain("2026-03-24");
  });
});

describe("csvResponse", () => {
  it("returns Response with correct content type", () => {
    const res = csvResponse("a,b\n1,2", "test.csv");
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("sets Content-Disposition with filename", () => {
    const res = csvResponse("a,b", "export.csv");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="export.csv"');
  });

  it("sets no-store cache control", () => {
    const res = csvResponse("a,b", "test.csv");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
