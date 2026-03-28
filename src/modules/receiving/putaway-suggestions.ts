"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

export interface PutawaySuggestion {
  binId: string;
  binCode: string;
  binBarcode: string;
  onHand: number;
  distance: "same" | "adjacent" | "other";
}

/**
 * Returns up to 5 suggested putaway bins for a product in a warehouse.
 *
 * Strategy (in priority order):
 *  1. Bins that already hold this product ("same") — consolidation
 *  2. Bins in the same aisle as existing stock ("adjacent")
 *  3. Empty available bins in storage zones ("other")
 */
export async function getPutawaySuggestions(
  productId: string,
  warehouseId: string
): Promise<PutawaySuggestion[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _getPutawaySuggestionsWithDb(tenant.db as any, productId, warehouseId);
}

async function _getPutawaySuggestionsWithDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  productId: string,
  warehouseId: string
): Promise<PutawaySuggestion[]> {
  // 1. Bins with existing stock for this product in the given warehouse
  const existingInventory = await db.inventory.findMany({
    where: {
      productId,
      onHand: { gt: 0 },
      bin: {
        status: "available",
        shelf: { rack: { aisle: { zone: { warehouseId } } } },
      },
    },
    include: {
      bin: {
        include: {
          shelf: { include: { rack: { include: { aisle: true } } } },
        },
      },
    },
    orderBy: { onHand: "desc" },
    take: 5,
  });

  const suggestions: PutawaySuggestion[] = existingInventory.map(
    (inv: {
      onHand: number;
      bin: {
        id: string;
        code: string;
        barcode: string;
        shelf: { rack: { aisle: { id: string } } };
      };
    }) => ({
      binId: inv.bin.id,
      binCode: inv.bin.code,
      binBarcode: inv.bin.barcode,
      onHand: inv.onHand,
      distance: "same" as const,
    })
  );

  if (suggestions.length >= 5) return suggestions;

  // Collect aisle IDs from same-stock bins for adjacent search
  const occupiedAisleIds = new Set(
    existingInventory.map(
      (inv: { bin: { shelf: { rack: { aisle: { id: string } } } } }) => inv.bin.shelf.rack.aisle.id
    )
  );
  const occupiedBinIds = new Set(suggestions.map((s) => s.binId));

  // 2. Adjacent: empty bins in the same aisle(s)
  if (occupiedAisleIds.size > 0) {
    const adjacentBins = await db.bin.findMany({
      where: {
        id: { notIn: [...occupiedBinIds] },
        status: "available",
        inventory: { none: {} },
        shelf: {
          rack: {
            aisle: {
              id: { in: [...occupiedAisleIds] },
              zone: { warehouseId },
            },
          },
        },
      },
      orderBy: { barcode: "asc" },
      take: 5 - suggestions.length,
    });

    for (const bin of adjacentBins as Array<{ id: string; code: string; barcode: string }>) {
      suggestions.push({
        binId: bin.id,
        binCode: bin.code,
        binBarcode: bin.barcode,
        onHand: 0,
        distance: "adjacent",
      });
      occupiedBinIds.add(bin.id);
    }
  }

  if (suggestions.length >= 5) return suggestions;

  // 3. Other: any available empty bin in a storage zone
  const otherBins = await db.bin.findMany({
    where: {
      id: { notIn: [...occupiedBinIds] },
      status: "available",
      inventory: { none: {} },
      shelf: { rack: { aisle: { zone: { type: "storage", warehouseId } } } },
    },
    orderBy: { barcode: "asc" },
    take: 5 - suggestions.length,
  });

  for (const bin of otherBins as Array<{ id: string; code: string; barcode: string }>) {
    suggestions.push({
      binId: bin.id,
      binCode: bin.code,
      binBarcode: bin.barcode,
      onHand: 0,
      distance: "other",
    });
  }

  return suggestions;
}

/**
 * Server action: resolve a shipment line → product, then return putaway suggestions.
 * Reuses the already-resolved tenant db to avoid a second requireTenantContext call.
 */
export async function getSuggestedBins(shipmentLineId: string): Promise<PutawaySuggestion[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const line = await db.inboundShipmentLine.findUnique({
    where: { id: shipmentLineId },
    include: {
      shipment: { select: { warehouseId: true } },
    },
  });

  if (!line) return [];
  if (!line.shipment?.warehouseId) return [];

  return _getPutawaySuggestionsWithDb(db, line.productId, line.shipment.warehouseId);
}
