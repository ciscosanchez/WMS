"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { asTenantDb } from "@/lib/tenant/db-types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedOrderLine {
  sku: string;
  quantity: number;
  lotNumber?: string | null;
  uom: string;
  notes?: string | null;
}

export interface ParsedOrder {
  clientCode: string;
  shipToName: string;
  shipToAddress1: string;
  shipToCity: string;
  shipToState?: string | null;
  shipToZip: string;
  shipToCountry?: string | null;
  shipToEmail?: string | null;
  shipToPhone?: string | null;
  priority: string;
  notes?: string | null;
  lines: ParsedOrderLine[];
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportSummary {
  created: number;
  errors: ImportError[];
}

export interface ImportPreview {
  orders: ParsedOrder[];
  errors: ImportError[];
  totalRows: number;
}

// ── CSV Row Schema ───────────────────────────────────────────────────────────

const csvRowSchema = z.object({
  clientCode: z.string().min(1, "clientCode is required"),
  shipToName: z.string().min(1, "shipToName is required"),
  shipToAddress1: z.string().min(1, "shipToAddress1 is required"),
  shipToCity: z.string().min(1, "shipToCity is required"),
  shipToZip: z.string().min(1, "shipToZip is required"),
  sku: z.string().min(1, "sku is required"),
  quantity: z.coerce.number().int().min(1, "quantity must be at least 1"),
  shipToState: z.string().optional().default(""),
  shipToCountry: z.string().optional().default("US"),
  shipToEmail: z.string().email().optional().or(z.literal("")),
  shipToPhone: z.string().optional().default(""),
  priority: z.enum(["standard", "expedited", "rush", "same_day"]).optional().default("standard"),
  lotNumber: z.string().optional().default(""),
  uom: z.string().optional().default("EA"),
  notes: z.string().optional().default(""),
});

type CsvRow = z.infer<typeof csvRowSchema>;

// ── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function orderKey(row: CsvRow): string {
  return `${row.clientCode}||${row.shipToName}||${row.shipToAddress1}`;
}

/**
 * Parse a CSV string into grouped orders with validation.
 * Rows sharing the same clientCode + shipToName + shipToAddress1 become one order.
 */
export function parseOrderCsv(csvContent: string): {
  orders: ParsedOrder[];
  errors: ImportError[];
} {
  const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    return {
      orders: [],
      errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }],
    };
  }

  const headerFields = parseCsvLine(rawLines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const errors: ImportError[] = [];
  const grouped = new Map<
    string,
    {
      header: CsvRow;
      lines: {
        row: number;
        sku: string;
        quantity: number;
        lotNumber: string;
        uom: string;
        notes: string;
      }[];
    }
  >();

  for (let i = 1; i < rawLines.length; i++) {
    const rowNum = i + 1; // 1-based, accounting for header
    const values = parseCsvLine(rawLines[i]);
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headerFields.length; j++) {
      rowObj[headerFields[j]] = values[j] ?? "";
    }

    const parsed = csvRowSchema.safeParse(rowObj);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      errors.push({ row: rowNum, message: msgs.join("; ") });
      continue;
    }

    const row = parsed.data;
    const key = orderKey(row);

    if (!grouped.has(key)) {
      grouped.set(key, {
        header: row,
        lines: [],
      });
    }

    grouped.get(key)!.lines.push({
      row: rowNum,
      sku: row.sku,
      quantity: row.quantity,
      lotNumber: row.lotNumber ?? "",
      uom: row.uom ?? "EA",
      notes: row.notes ?? "",
    });
  }

  const orders: ParsedOrder[] = [];
  for (const [, group] of grouped) {
    const h = group.header;
    orders.push({
      clientCode: h.clientCode,
      shipToName: h.shipToName,
      shipToAddress1: h.shipToAddress1,
      shipToCity: h.shipToCity,
      shipToState: h.shipToState || null,
      shipToZip: h.shipToZip,
      shipToCountry: h.shipToCountry || "US",
      shipToEmail: h.shipToEmail || null,
      shipToPhone: h.shipToPhone || null,
      priority: h.priority ?? "standard",
      notes: h.notes || null,
      lines: group.lines.map((l) => ({
        sku: l.sku,
        quantity: l.quantity,
        lotNumber: l.lotNumber || null,
        uom: l.uom,
        notes: l.notes || null,
      })),
    });
  }

  return { orders, errors };
}

// ── Server Actions ───────────────────────────────────────────────────────────

/**
 * Preview what a CSV import would create, without writing to the database.
 */
export async function validateImportPreview(csvContent: string): Promise<ImportPreview> {
  await requireTenantContext("orders:read");

  const { orders, errors } = parseOrderCsv(csvContent);
  const totalRows = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1;

  return { orders, errors, totalRows };
}

/**
 * Import parsed orders into the database.
 * Looks up clients by code and products by SKU, then creates orders + lines
 * in a transaction. Returns a summary of what was created and any errors.
 */
export async function importOrders(
  tenantSlug: string,
  orders: ParsedOrder[]
): Promise<ImportSummary> {
  const { user, tenant, portalClientId } = await requireTenantContext("orders:write");
  const db = asTenantDb(tenant.db);

  const summary: ImportSummary = { created: 0, errors: [] };

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderIdx = i + 1;

    try {
      // Look up client by code
      const client = await db.client.findFirst({
        where: { code: order.clientCode },
        select: { id: true },
      });
      if (!client) {
        summary.errors.push({
          row: orderIdx,
          message: `Client not found: "${order.clientCode}"`,
        });
        continue;
      }

      // Portal users may only import orders for their bound client
      if (portalClientId && client.id !== portalClientId) {
        summary.errors.push({
          row: orderIdx,
          message: `Access denied: you may only import orders for your bound client`,
        });
        continue;
      }

      // Look up all products by SKU
      const skus = order.lines.map((l) => l.sku);
      const products = (await db.product.findMany({
        where: { sku: { in: skus } },
        select: { id: true, sku: true },
      })) as Array<{ id: string; sku: string }>;

      const productBySku = new Map(products.map((p) => [p.sku, p.id]));

      // Check for missing SKUs
      const missingSKUs = skus.filter((s) => !productBySku.has(s));
      if (missingSKUs.length > 0) {
        summary.errors.push({
          row: orderIdx,
          message: `Unknown SKU(s): ${missingSKUs.join(", ")}`,
        });
        continue;
      }

      // Generate order number and create in a transaction
      const orderNumber = await nextSequence(tenant.db, "ORD");

      await db.$transaction(async (tx: unknown) => {
        const prisma = asTenantDb(tx);
        const createdOrder = await prisma.order.create({
          data: {
            orderNumber,
            clientId: client.id,
            status: "pending",
            priority: order.priority,
            shipToName: order.shipToName,
            shipToAddress1: order.shipToAddress1,
            shipToCity: order.shipToCity,
            shipToState: order.shipToState,
            shipToZip: order.shipToZip,
            shipToCountry: order.shipToCountry ?? "US",
            shipToEmail: order.shipToEmail,
            shipToPhone: order.shipToPhone,
            notes: order.notes,
          },
        });

        for (const line of order.lines) {
          const productId = productBySku.get(line.sku)!;
          await prisma.orderLine.create({
            data: {
              orderId: (createdOrder as { id: string }).id,
              productId,
              quantity: line.quantity,
              uom: line.uom,
              lotNumber: line.lotNumber,
              notes: line.notes,
            },
          });
        }

        return createdOrder;
      });

      summary.created++;

      await logAudit(tenant.db, {
        userId: user.id,
        action: "create",
        entityType: "order",
        entityId: orderNumber,
        changes: { source: { old: null, new: "csv_import" } },
      });
    } catch (err) {
      summary.errors.push({
        row: orderIdx,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (summary.created > 0) {
    revalidatePath("/orders");
  }

  return summary;
}
