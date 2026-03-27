"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import type { RateQuote, LabelRequest } from "@/lib/integrations/carriers/types";
import { publicDb } from "@/lib/db/public-client";
import { getCarrierCredentials, type TenantEntry } from "@/lib/integrations/tenant-connectors";
import { resolveShipmentPackage } from "./package-defaults";

async function getReadContext() {
  return requireTenantContext("shipping:read");
}

async function getDefaultCartonType(db: {
  cartonType: { findFirst(args: unknown): Promise<unknown> };
}) {
  return db.cartonType.findFirst({
    where: { isActive: true },
    orderBy: [{ length: "asc" }, { width: "asc" }, { height: "asc" }],
    select: {
      length: true,
      width: true,
      height: true,
      dimUnit: true,
      tareWeight: true,
      weightUnit: true,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShipments(): Promise<any[]> {
  if (config.useMockData) return [];

  const { tenant } = await getReadContext();
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

  const { tenant } = await getReadContext();
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
    const { tenant } = await getReadContext();

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) return { rates: [], error: "Shipment not found" };
    const defaultCarton = await getDefaultCartonType(tenant.db as never);

    const { UPSAdapter } = await import("@/lib/integrations/carriers/ups");
    const { FedExAdapter } = await import("@/lib/integrations/carriers/fedex");
    const { USPSAdapter } = await import("@/lib/integrations/carriers/usps");

    // Resolve tenant credentials (DB first, env var fallback)
    const tenantEntry = await getTenantEntry(tenant.tenantId);
    const creds = tenantEntry ? getCarrierCredentials(tenantEntry) : {};
    const from = getWarehouseAddress(tenantEntry);

    const to = {
      name: shipment.order?.shipToName ?? "",
      street1: shipment.order?.shipToAddress1 ?? "",
      city: shipment.order?.shipToCity ?? "",
      state: shipment.order?.shipToState ?? "",
      zip: shipment.order?.shipToZip ?? "",
      country: shipment.order?.shipToCountry ?? "US",
      isResidential: true,
    };

    const pkg = resolveShipmentPackage(shipment, defaultCarton as never);

    const rateRequest = { from, to, packages: [pkg] };

    // Build adapters from tenant-scoped credentials
    const adapterList = [];
    if (creds.ups) {
      adapterList.push(
        new UPSAdapter({
          accountNumber: creds.ups.accountNumber,
          clientId: creds.ups.clientId,
          clientSecret: creds.ups.clientSecret,
          useSandbox: process.env.UPS_SANDBOX === "true",
        })
      );
    }
    if (creds.fedex) {
      adapterList.push(
        new FedExAdapter({
          accountNumber: creds.fedex.accountNumber,
          clientId: creds.fedex.clientId,
          clientSecret: creds.fedex.clientSecret,
          useSandbox: process.env.FEDEX_SANDBOX === "true",
        })
      );
    }
    if (creds.usps) {
      adapterList.push(
        new USPSAdapter({
          clientId: creds.usps.clientId,
          clientSecret: creds.usps.clientSecret,
          useSandbox: process.env.USPS_SANDBOX === "true",
        })
      );
    }

    // Fail closed: no credentials → no rates
    if (adapterList.length === 0) {
      return {
        rates: [],
        error:
          "No carrier credentials configured. Add UPS, FedEx, or USPS API keys to enable rate shopping.",
      };
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

// ── Tenant-scoped helpers ────────────────────────────────────────────────

async function getTenantEntry(tenantId: string): Promise<TenantEntry | null> {
  const row = await publicDb.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, dbSchema: true, settings: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    dbSchema: row.dbSchema,
    settings: (row.settings ?? {}) as Record<string, unknown>,
  };
}

function getWarehouseAddress(tenantEntry: TenantEntry | null) {
  const wh = (tenantEntry?.settings as Record<string, Record<string, string>> | undefined)
    ?.warehouse;
  return {
    name: wh?.name || "Warehouse",
    company: wh?.company || process.env.WAREHOUSE_COMPANY || "Armstrong WMS",
    street1: wh?.street1 || process.env.WAREHOUSE_ADDRESS || "100 Warehouse Blvd",
    city: wh?.city || process.env.WAREHOUSE_CITY || "Dallas",
    state: wh?.state || process.env.WAREHOUSE_STATE || "TX",
    zip: wh?.zip || process.env.WAREHOUSE_ZIP || "75201",
    country: wh?.country || "US",
    phone: wh?.phone || process.env.WAREHOUSE_PHONE || "",
  };
}

// ── Carrier adapter factory (tenant-scoped) ─────────────────────────────

async function getAdapterForCarrier(carrier: string, tenantId: string) {
  const { UPSAdapter } = await import("@/lib/integrations/carriers/ups");
  const { FedExAdapter } = await import("@/lib/integrations/carriers/fedex");
  const { USPSAdapter } = await import("@/lib/integrations/carriers/usps");

  const tenantEntry = await getTenantEntry(tenantId);
  const creds = tenantEntry ? getCarrierCredentials(tenantEntry) : {};

  const name = carrier.toLowerCase();
  if (name.includes("ups") && creds.ups) {
    return new UPSAdapter({
      accountNumber: creds.ups.accountNumber,
      clientId: creds.ups.clientId,
      clientSecret: creds.ups.clientSecret,
      useSandbox: process.env.UPS_SANDBOX === "true",
    });
  }
  if (name.includes("fedex") && creds.fedex) {
    return new FedExAdapter({
      accountNumber: creds.fedex.accountNumber,
      clientId: creds.fedex.clientId,
      clientSecret: creds.fedex.clientSecret,
      useSandbox: process.env.FEDEX_SANDBOX === "true",
    });
  }
  if (name.includes("usps") && creds.usps) {
    return new USPSAdapter({
      clientId: creds.usps.clientId,
      clientSecret: creds.usps.clientSecret,
      useSandbox: process.env.USPS_SANDBOX === "true",
    });
  }
  return null;
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
    const defaultCarton = await getDefaultCartonType(tenant.db as never);

    const tenantEntry = await getTenantEntry(tenant.tenantId);
    const wh = getWarehouseAddress(tenantEntry);
    const from: LabelRequest["from"] = {
      name: wh.name,
      company: wh.company,
      street1: wh.street1,
      city: wh.city,
      state: wh.state,
      zip: wh.zip,
      country: wh.country,
      phone: wh.phone,
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

    const packages: LabelRequest["packages"] = [resolveShipmentPackage(shipment, defaultCarton as never)];

    const labelRequest: LabelRequest = {
      from,
      to,
      packages,
      serviceCode: shipment.service ?? "03",
      reference: shipment.shipmentNumber,
    };

    const adapter = await getAdapterForCarrier(shipment.carrier, tenant.tenantId);

    if (!adapter) {
      return {
        error: `No credentials configured for carrier "${shipment.carrier}". Add API keys before generating labels.`,
      };
    }

    const result = await adapter.createLabel(labelRequest);
    const trackingNumber = result.trackingNumber;
    const labelBase64 = result.labelData;
    const labelCost =
      result.totalCost > 0
        ? result.totalCost
        : shipment.shippingCost
          ? Number(shipment.shippingCost)
          : 0;

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
      changes: {
        status: { old: shipment.status, new: "label_created" },
        trackingNumber: { old: null, new: trackingNumber },
      },
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
