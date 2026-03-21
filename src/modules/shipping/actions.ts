"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { pushShopifyFulfillment } from "@/modules/orders/shopify-sync";
import type { RateQuote, LabelRequest } from "@/lib/integrations/carriers/types";

async function getContext() {
  return requireTenantContext();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShipments(): Promise<any[]> {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.shipment.findMany({
    include: {
      order: { include: { client: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShipment(id: string): Promise<any | null> {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.shipment.findUnique({
    where: { id },
    include: {
      order: { include: { client: true } },
      items: { include: { product: true } },
    },
  });
}

/**
 * Get multi-carrier rate quotes for a shipment.
 * Uses mock adapter data until real carrier credentials are configured.
 */
export async function getRatesForShipment(
  shipmentId: string
): Promise<{ rates: (RateQuote & { carrier: string })[]; error?: string }> {
  if (config.useMockData) return { rates: [] };

  try {
    const { tenant } = await requireTenantContext();

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) return { rates: [], error: "Shipment not found" };

    const { UPSAdapter } = await import("@/lib/integrations/carriers/ups");
    const { FedExAdapter } = await import("@/lib/integrations/carriers/fedex");
    const { USPSAdapter } = await import("@/lib/integrations/carriers/usps");

    const from = {
      name: "Warehouse",
      company: "Armstrong WMS",
      street1: process.env.WAREHOUSE_ADDRESS ?? "100 Warehouse Blvd",
      city: process.env.WAREHOUSE_CITY ?? "Dallas",
      state: process.env.WAREHOUSE_STATE ?? "TX",
      zip: process.env.WAREHOUSE_ZIP ?? "75201",
      country: "US",
    };

    const to = {
      name: shipment.order?.shipToName ?? "",
      street1: shipment.order?.shipToAddress1 ?? "",
      city: shipment.order?.shipToCity ?? "",
      state: shipment.order?.shipToState ?? "",
      zip: shipment.order?.shipToZip ?? "",
      country: shipment.order?.shipToCountry ?? "US",
      isResidential: true,
    };

    const pkg = {
      weight: shipment.packageWeight ? Number(shipment.packageWeight) : 1,
      weightUnit: "lb" as const,
      length: shipment.packageLength ? Number(shipment.packageLength) : 12,
      width: shipment.packageWidth ? Number(shipment.packageWidth) : 10,
      height: shipment.packageHeight ? Number(shipment.packageHeight) : 6,
      dimUnit: "in" as const,
    };

    const rateRequest = { from, to, packages: [pkg] };

    // Build adapters from env vars; skip any without credentials
    const adapterList = [];
    if (process.env.UPS_CLIENT_ID) {
      adapterList.push(new UPSAdapter({
        accountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "",
        clientId: process.env.UPS_CLIENT_ID,
        clientSecret: process.env.UPS_CLIENT_SECRET ?? "",
        useSandbox: process.env.UPS_SANDBOX === "true",
      }));
    }
    if (process.env.FEDEX_CLIENT_ID) {
      adapterList.push(new FedExAdapter({
        accountNumber: process.env.FEDEX_ACCOUNT_NUMBER ?? "",
        clientId: process.env.FEDEX_CLIENT_ID,
        clientSecret: process.env.FEDEX_CLIENT_SECRET ?? "",
        useSandbox: process.env.FEDEX_SANDBOX === "true",
      }));
    }
    if (process.env.USPS_CLIENT_ID) {
      adapterList.push(new USPSAdapter({
        clientId: process.env.USPS_CLIENT_ID,
        clientSecret: process.env.USPS_CLIENT_SECRET ?? "",
        useSandbox: process.env.USPS_SANDBOX === "true",
      }));
    }

    // Fail closed: no credentials → no rates (don't fake sandbox rates)
    if (adapterList.length === 0) {
      return { rates: [], error: "No carrier credentials configured. Add UPS, FedEx, or USPS API keys to enable rate shopping." };
    }

    const results = await Promise.allSettled(adapterList.map((a) => a.getRates(rateRequest)));
    const rates = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => a.totalCost - b.totalCost);

    return { rates };
  } catch (err) {
    return { rates: [], error: err instanceof Error ? err.message : "Rate fetch failed" };
  }
}

/**
 * Save selected carrier/service to a shipment (pre-label selection).
 */
export async function selectShipmentRate(
  shipmentId: string,
  carrier: string,
  service: string,
  cost: number
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { tenant } = await requireTenantContext("shipping:write");
    await tenant.db.shipment.update({
      where: { id: shipmentId },
      data: { carrier, service, shippingCost: cost, status: "label_created" },
    });
    revalidatePath(`/shipping/${shipmentId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to select rate" };
  }
}

// ── Carrier adapter factory ───────────────────────────────────────────────

async function getAdapterForCarrier(carrier: string) {
  const { UPSAdapter } = await import("@/lib/integrations/carriers/ups");
  const { FedExAdapter } = await import("@/lib/integrations/carriers/fedex");
  const { USPSAdapter } = await import("@/lib/integrations/carriers/usps");

  const name = carrier.toLowerCase();
  if (name.includes("ups") && process.env.UPS_CLIENT_ID) {
    return new UPSAdapter({
      accountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "",
      clientId: process.env.UPS_CLIENT_ID,
      clientSecret: process.env.UPS_CLIENT_SECRET ?? "",
      useSandbox: process.env.UPS_SANDBOX === "true",
    });
  }
  if (name.includes("fedex") && process.env.FEDEX_CLIENT_ID) {
    return new FedExAdapter({
      accountNumber: process.env.FEDEX_ACCOUNT_NUMBER ?? "",
      clientId: process.env.FEDEX_CLIENT_ID,
      clientSecret: process.env.FEDEX_CLIENT_SECRET ?? "",
      useSandbox: process.env.FEDEX_SANDBOX === "true",
    });
  }
  if (name.includes("usps") && process.env.USPS_CLIENT_ID) {
    return new USPSAdapter({
      clientId: process.env.USPS_CLIENT_ID,
      clientSecret: process.env.USPS_CLIENT_SECRET ?? "",
      useSandbox: process.env.USPS_SANDBOX === "true",
    });
  }
  return null; // No credentials configured for this carrier
}

/**
 * Generate a shipping label for a shipment that already has carrier/service selected.
 * Calls the carrier API, stores the PDF label in MinIO, saves tracking number.
 */
export async function generateShipmentLabel(
  shipmentId: string
): Promise<{ trackingNumber?: string; labelKey?: string; error?: string }> {
  if (config.useMockData) return { error: "Mock mode" };

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    const { uploadBuffer } = await import("@/lib/s3/client");
    const { getPresignedDownloadUrl } = await import("@/lib/s3/client");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) return { error: "Shipment not found" };
    if (!shipment.carrier) return { error: "No carrier selected — use rate shopping first" };

    const from: LabelRequest["from"] = {
      name: "Warehouse",
      company: process.env.WAREHOUSE_COMPANY ?? "Armstrong WMS",
      street1: process.env.WAREHOUSE_ADDRESS ?? "100 Warehouse Blvd",
      city: process.env.WAREHOUSE_CITY ?? "Dallas",
      state: process.env.WAREHOUSE_STATE ?? "TX",
      zip: process.env.WAREHOUSE_ZIP ?? "75201",
      country: "US",
      phone: process.env.WAREHOUSE_PHONE ?? "",
    };

    const to: LabelRequest["to"] = {
      name: shipment.order.shipToName ?? "",
      street1: shipment.order.shipToAddress1 ?? "",
      street2: shipment.order.shipToAddress2 ?? undefined,
      city: shipment.order.shipToCity ?? "",
      state: shipment.order.shipToState ?? "",
      zip: shipment.order.shipToZip ?? "",
      country: shipment.order.shipToCountry ?? "US",
      phone: shipment.order.shipToPhone ?? undefined,
      email: shipment.order.shipToEmail ?? undefined,
      isResidential: true,
    };

    const packages: LabelRequest["packages"] = [{
      weight: shipment.packageWeight ? Number(shipment.packageWeight) : 1,
      weightUnit: "lb",
      length: shipment.packageLength ? Number(shipment.packageLength) : 12,
      width: shipment.packageWidth ? Number(shipment.packageWidth) : 10,
      height: shipment.packageHeight ? Number(shipment.packageHeight) : 6,
      dimUnit: "in",
    }];

    const labelRequest: LabelRequest = {
      from,
      to,
      packages,
      serviceCode: shipment.service ?? "03",
      reference: shipment.shipmentNumber,
    };

    const adapter = await getAdapterForCarrier(shipment.carrier);

    if (!adapter) {
      return { error: `No credentials configured for carrier "${shipment.carrier}". Add API keys before generating labels.` };
    }

    const result = await adapter.createLabel(labelRequest);
    const trackingNumber = result.trackingNumber;
    const labelBase64 = result.labelData;
    const labelCost = result.totalCost > 0 ? result.totalCost : (shipment.shippingCost ? Number(shipment.shippingCost) : 0);

    // Store PDF in MinIO
    const labelKey = `labels/${shipment.shipmentNumber}.pdf`;
    const pdfBuffer = Buffer.from(labelBase64, "base64");
    await uploadBuffer(labelKey, pdfBuffer, "application/pdf");

    // Persist tracking number, label key, cost and status
    await tenant.db.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingNumber,
        labelUrl: labelKey,
        shippingCost: labelCost,
        status: "label_created",
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "shipment",
      entityId: shipmentId,
      changes: { status: { old: shipment.status, new: "label_created" }, trackingNumber: { old: null, new: trackingNumber } },
    });

    // Generate a short-lived presigned URL to open immediately
    const downloadUrl = await getPresignedDownloadUrl(labelKey, 300); // 5 min

    revalidatePath(`/shipping/${shipmentId}`);
    return { trackingNumber, labelKey: downloadUrl };
  } catch (err) {
    console.error("[generateShipmentLabel]", err);
    return { error: err instanceof Error ? err.message : "Label generation failed" };
  }
}

/**
 * Generate a presigned download URL for an existing stored label.
 */
export async function getLabelDownloadUrl(
  shipmentId: string
): Promise<{ url?: string; error?: string }> {
  try {
    const { tenant } = await requireTenantContext();
    const { getPresignedDownloadUrl } = await import("@/lib/s3/client");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      select: { labelUrl: true },
    });

    if (!shipment?.labelUrl) return { error: "No label on file" };

    const url = await getPresignedDownloadUrl(shipment.labelUrl, 300); // 5 min
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get label URL" };
  }
}

/**
 * Mark a shipment as shipped and update the parent order status.
 * Pushes tracking info back to Shopify if the order came from that channel.
 */
export async function markShipmentShipped(
  shipmentId: string,
  trackingNumber: string,
  carrier: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true, items: true },
    });
    if (!shipment) throw new Error("Shipment not found");

    // Atomic: update shipment + order status + decrement inventory + write ledger
    await tenant.db.$transaction(async (prisma) => {
      // Update shipment
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          trackingNumber,
          carrier,
          status: "shipped",
          shippedAt: new Date(),
        },
      });

      // Update order status to shipped
      await prisma.order.update({
        where: { id: shipment.orderId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: "shipped" as any, shippedDate: new Date() },
      });

      // Decrement inventory: release allocation and reduce onHand for each shipped item
      for (const item of shipment.items) {
        // Find the inventory record for this product (use the pick task's bin if available)
        const pickTask = await prisma.pickTask.findFirst({
          where: { orderId: shipment.orderId },
          include: { lines: true },
        });
        const pickLine = pickTask?.lines.find(
          (l) => l.productId === item.productId
        );

        if (pickLine?.binId) {
          const inv = await prisma.inventory.findFirst({
            where: {
              productId: item.productId,
              binId: pickLine.binId,
              lotNumber: item.lotNumber,
              serialNumber: item.serialNumber,
            },
          });

          if (inv) {
            const decrQty = Math.min(item.quantity, inv.onHand);
            const deallocQty = Math.min(item.quantity, inv.allocated);
            await prisma.inventory.update({
              where: { id: inv.id },
              data: {
                onHand: { decrement: decrQty },
                allocated: { decrement: deallocQty },
                // available stays the same: (onHand - decrQty) - (allocated - deallocQty)
                // only adjust if allocated was less than what we're shipping
                available: inv.available - (decrQty - deallocQty),
              },
            });

            // Write ledger entry
            await prisma.inventoryTransaction.create({
              data: {
                type: "deallocate",
                productId: item.productId,
                fromBinId: pickLine.binId,
                quantity: item.quantity,
                lotNumber: item.lotNumber,
                serialNumber: item.serialNumber,
                referenceType: "shipment",
                referenceId: shipmentId,
                performedBy: user.id,
              },
            });
          }
        }
      }
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "shipment",
      entityId: shipmentId,
      changes: { status: { old: "pending", new: "shipped" }, trackingNumber: { old: null, new: trackingNumber } },
    });

    // Push tracking to Shopify (fire-and-forget — don't block on error)
    if (shipment.order.externalId) {
      pushShopifyFulfillment(shipment.orderId, trackingNumber, carrier).catch((err) => {
        console.error("[Shopify] Failed to push fulfillment:", err);
      });
    }

    revalidatePath("/shipping");
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark shipment shipped" };
  }
}
