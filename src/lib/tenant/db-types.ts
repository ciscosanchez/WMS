/**
 * Lightweight type for tenant database operations.
 *
 * This avoids scattering `as any` across every module. Instead, modules
 * import `TenantDb` and cast once. When Prisma client IS generated (CI/prod),
 * the real PrismaClient type provides full safety. When it's NOT generated
 * (local dev without db:generate), this type provides basic model shapes.
 *
 * Usage in modules:
 *   import { asTenantDb } from "@/lib/tenant/db-types";
 *   const db = asTenantDb(tenant.db);
 *   db.order.findMany(...)  // typed as any but centralized
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelProxy = Record<string, (...args: any[]) => any>;

export interface TenantDb {
  $transaction: (fn: (prisma: TenantDb) => Promise<unknown>) => Promise<unknown>;
  // Core models
  client: ModelProxy;
  product: ModelProxy;
  warehouse: ModelProxy;
  zone: ModelProxy;
  bin: ModelProxy;
  // Inventory
  inventory: ModelProxy;
  inventoryTransaction: ModelProxy;
  inventoryAdjustment: ModelProxy;
  // Receiving
  inboundShipment: ModelProxy;
  inboundShipmentLine: ModelProxy;
  receivingTransaction: ModelProxy;
  receivingDiscrepancy: ModelProxy;
  // Orders + Fulfillment
  order: ModelProxy;
  orderLine: ModelProxy;
  salesChannel: ModelProxy;
  pickTask: ModelProxy;
  pickTaskLine: ModelProxy;
  shipment: ModelProxy;
  shipmentItem: ModelProxy;
  // Billing
  rateCard: ModelProxy;
  billingEvent: ModelProxy;
  invoice: ModelProxy;
  // Yard & Dock
  dockDoor: ModelProxy;
  yardSpot: ModelProxy;
  dockAppointment: ModelProxy;
  yardVisit: ModelProxy;
  // Labor
  operatorShift: ModelProxy;
  taskTimeLog: ModelProxy;
  laborRate: ModelProxy;
  // Returns
  returnAuthorization: ModelProxy;
  returnLine: ModelProxy;
  returnInspection: ModelProxy;
  // Cartonization
  cartonType: ModelProxy;
  packPlan: ModelProxy;
  packPlanLine: ModelProxy;
  // Slotting
  slottingConfig: ModelProxy;
  slottingRun: ModelProxy;
  slottingRecommendation: ModelProxy;
  // Interleaving
  interleavedRoute: ModelProxy;
  interleavedStep: ModelProxy;
  // VAS
  kitDefinition: ModelProxy;
  kitComponent: ModelProxy;
  vasTask: ModelProxy;
  // Cross-Dock
  crossDockRule: ModelProxy;
  crossDockPlan: ModelProxy;
  // Compliance
  complianceCheck: ModelProxy;
  hazmatFlag: ModelProxy;
  // Automation
  automationDevice: ModelProxy;
  deviceTask: ModelProxy;
  // Infrastructure
  auditLog: ModelProxy;
  notification: ModelProxy;
  sequenceCounter: ModelProxy;
  putawayRule: ModelProxy;
  document: ModelProxy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Cast a tenant PrismaClient to TenantDb.
 * Centralizes the `as any` cast to one location.
 */
export function asTenantDb(db: unknown): TenantDb {
  return db as TenantDb;
}
