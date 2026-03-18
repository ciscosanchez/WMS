import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

export type PutawayStrategy = "fixed" | "zone" | "closest_empty" | "consolidate";

export interface BinSuggestion {
  binId: string;
  barcode: string;
  reason: string;
}

export interface PutawayRule {
  id: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  binId: string | null;
  binBarcode: string | null;
  zoneCode: string | null;
  strategy: PutawayStrategy;
  priority: number;
  isActive: boolean;
}

// ── Mock data for putaway rules ─────────────────────────

export const mockPutawayRules: PutawayRule[] = [
  {
    id: "pr-1",
    productId: "1",
    productSku: "WIDGET-001",
    productName: "Standard Widget",
    binId: "bin-a1",
    binBarcode: "WH1-A-01-01-01-01",
    zoneCode: "A",
    strategy: "fixed",
    priority: 1,
    isActive: true,
  },
  {
    id: "pr-2",
    productId: "4",
    productSku: "BOLT-M8X40",
    productName: "M8x40 Hex Bolt",
    binId: null,
    binBarcode: null,
    zoneCode: "B",
    strategy: "zone",
    priority: 2,
    isActive: true,
  },
  {
    id: "pr-3",
    productId: null,
    productSku: null,
    productName: null,
    binId: null,
    binBarcode: null,
    zoneCode: null,
    strategy: "closest_empty",
    priority: 10,
    isActive: true,
  },
  {
    id: "pr-4",
    productId: "2",
    productSku: "GADGET-001",
    productName: "Premium Gadget",
    binId: null,
    binBarcode: null,
    zoneCode: "A",
    strategy: "consolidate",
    priority: 1,
    isActive: false,
  },
];

// ── Mock bins for suggestions ───────────────────────────

const mockBins = [
  { id: "bin-a1", barcode: "WH1-A-01-01-01-01", zone: "A", hasInventory: true, productId: "1" },
  { id: "bin-a2", barcode: "WH1-A-01-01-01-02", zone: "A", hasInventory: false, productId: null },
  { id: "bin-a3", barcode: "WH1-A-01-01-01-03", zone: "A", hasInventory: true, productId: "2" },
  { id: "bin-a4", barcode: "WH1-A-01-01-02-01", zone: "A", hasInventory: false, productId: null },
  { id: "bin-b1", barcode: "WH1-B-02-01-01-01", zone: "B", hasInventory: false, productId: null },
  { id: "bin-b2", barcode: "WH1-B-02-01-01-05", zone: "B", hasInventory: true, productId: "4" },
  { id: "bin-b3", barcode: "WH1-B-02-02-01-01", zone: "B", hasInventory: true, productId: "5" },
  { id: "bin-b4", barcode: "WH1-B-02-02-01-02", zone: "B", hasInventory: false, productId: null },
  { id: "bin-s1", barcode: "WH1-S-01-01-01-01", zone: "S", hasInventory: false, productId: null },
  { id: "bin-c1", barcode: "WH2-C-01-01-01-01", zone: "C", hasInventory: true, productId: "7" },
  { id: "bin-c2", barcode: "WH2-C-01-01-01-02", zone: "C", hasInventory: false, productId: null },
];

// ── Putaway engine ──────────────────────────────────────

function mockFixed(productId: string): BinSuggestion | null {
  const rule = mockPutawayRules.find(
    (r) => r.strategy === "fixed" && r.productId === productId && r.isActive
  );
  if (rule?.binBarcode) {
    return {
      binId: rule.binId!,
      barcode: rule.binBarcode,
      reason: `Fixed location rule (priority ${rule.priority})`,
    };
  }
  return null;
}

function mockZone(productId: string, zoneCode?: string): BinSuggestion | null {
  // Check if there is a zone rule for this product
  const rule = mockPutawayRules.find(
    (r) => r.strategy === "zone" && r.productId === productId && r.isActive
  );
  const zone = zoneCode ?? rule?.zoneCode;
  if (!zone) return null;

  const emptyBin = mockBins.find((b) => b.zone === zone && !b.hasInventory);
  if (emptyBin) {
    return {
      binId: emptyBin.id,
      barcode: emptyBin.barcode,
      reason: `First available bin in Zone ${zone}`,
    };
  }
  return null;
}

function mockClosestEmpty(): BinSuggestion | null {
  const emptyBin = mockBins.find((b) => !b.hasInventory);
  if (emptyBin) {
    return {
      binId: emptyBin.id,
      barcode: emptyBin.barcode,
      reason: "Nearest empty bin",
    };
  }
  return null;
}

function mockConsolidate(productId: string): BinSuggestion | null {
  const bin = mockBins.find((b) => b.hasInventory && b.productId === productId);
  if (bin) {
    return {
      binId: bin.id,
      barcode: bin.barcode,
      reason: "Consolidate with existing stock",
    };
  }
  return null;
}

export async function suggestPutawayLocation(
  productId: string,
  _quantity: number,
  options?: { zoneCode?: string }
): Promise<BinSuggestion[]> {
  if (config.useMockData) {
    const suggestions: BinSuggestion[] = [];

    // 1. Check fixed rule
    const fixed = mockFixed(productId);
    if (fixed) suggestions.push(fixed);

    // 2. Check consolidate
    const consolidate = mockConsolidate(productId);
    if (consolidate && !suggestions.some((s) => s.binId === consolidate.binId)) {
      suggestions.push(consolidate);
    }

    // 3. Check zone rule
    const zone = mockZone(productId, options?.zoneCode);
    if (zone && !suggestions.some((s) => s.binId === zone.binId)) {
      suggestions.push(zone);
    }

    // 4. Closest empty fallback
    const closest = mockClosestEmpty();
    if (closest && !suggestions.some((s) => s.binId === closest.binId)) {
      suggestions.push(closest);
    }

    return suggestions.length > 0
      ? suggestions
      : [{ binId: "", barcode: "N/A", reason: "No bins available" }];
  }

  // ── Real DB mode ────────────────────────────────────
  const { tenant } = await requireTenantContext();

  const suggestions: BinSuggestion[] = [];

  // Load rules sorted by priority
  const rules = await tenant.db.putawayRule.findMany({
    where: {
      isActive: true,
      OR: [{ productId }, { productId: null }],
    },
    include: { bin: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    switch (rule.strategy) {
      case "fixed": {
        if (rule.bin) {
          suggestions.push({
            binId: rule.bin.id,
            barcode: rule.bin.barcode,
            reason: `Fixed location rule (priority ${rule.priority})`,
          });
        }
        break;
      }
      case "zone": {
        const zoneCode = options?.zoneCode ?? rule.zoneCode;
        if (!zoneCode) break;
        const bin = await tenant.db.bin.findFirst({
          where: {
            status: "available",
            shelf: {
              rack: { aisle: { zone: { code: zoneCode } } },
            },
            inventory: { none: {} },
          },
        });
        if (bin) {
          suggestions.push({
            binId: bin.id,
            barcode: bin.barcode,
            reason: `First available bin in Zone ${zoneCode}`,
          });
        }
        break;
      }
      case "closest_empty": {
        const bin = await tenant.db.bin.findFirst({
          where: {
            status: "available",
            inventory: { none: {} },
          },
        });
        if (bin) {
          suggestions.push({
            binId: bin.id,
            barcode: bin.barcode,
            reason: "Nearest empty bin",
          });
        }
        break;
      }
      case "consolidate": {
        const inv = await tenant.db.inventory.findFirst({
          where: { productId },
          include: { bin: true },
          orderBy: { available: "desc" },
        });
        if (inv?.bin) {
          suggestions.push({
            binId: inv.bin.id,
            barcode: inv.bin.barcode,
            reason: "Consolidate with existing stock",
          });
        }
        break;
      }
    }
  }

  // Fallback: any empty bin
  if (suggestions.length === 0) {
    const fallback = await tenant.db.bin.findFirst({
      where: { status: "available", inventory: { none: {} } },
    });
    if (fallback) {
      suggestions.push({
        binId: fallback.id,
        barcode: fallback.barcode,
        reason: "Nearest empty bin (fallback)",
      });
    }
  }

  return suggestions.length > 0
    ? suggestions
    : [{ binId: "", barcode: "N/A", reason: "No bins available" }];
}
