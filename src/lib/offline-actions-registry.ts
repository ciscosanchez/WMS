"use client";

/**
 * Centralized offline action registry.
 *
 * Imports and registers ALL operator mutation actions in one place,
 * so they're available for replay regardless of which operator page
 * the user is on when connectivity returns.
 *
 * Imported by OfflineProvider — runs once on operator app mount.
 */

import { registerOfflineActions } from "@/hooks/use-offline";

// Operator actions
import {
  claimPickTask,
  confirmPickLine,
  markPickLineShort,
  confirmPack,
  submitCount,
} from "@/modules/operator/actions";

// Receiving actions
import {
  receiveLine,
  updateShipmentStatus,
} from "@/modules/receiving/actions";

// Inventory actions
import {
  moveInventory,
} from "@/modules/inventory/actions";

export function registerAllOfflineActions() {
  registerOfflineActions("operator", {
    claimPickTask: claimPickTask as (...args: unknown[]) => Promise<unknown>,
    confirmPickLine: confirmPickLine as (...args: unknown[]) => Promise<unknown>,
    markPickLineShort: markPickLineShort as (...args: unknown[]) => Promise<unknown>,
    confirmPack: confirmPack as (...args: unknown[]) => Promise<unknown>,
    submitCount: submitCount as (...args: unknown[]) => Promise<unknown>,
  });

  registerOfflineActions("receiving", {
    receiveLine: receiveLine as (...args: unknown[]) => Promise<unknown>,
    updateShipmentStatus: updateShipmentStatus as (...args: unknown[]) => Promise<unknown>,
  });

  registerOfflineActions("inventory", {
    moveInventory: moveInventory as (...args: unknown[]) => Promise<unknown>,
  });
}
