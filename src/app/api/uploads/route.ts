import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, ensureBucket } from "@/lib/s3/client";
import { getSession } from "@/lib/auth/session";
import { resolveTenant } from "@/lib/tenant/context";
import { rateLimiter } from "@/lib/security/rate-limit";
import { v4 as uuid } from "uuid";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "text/csv",
  "text/plain",
]);

const ALLOWED_ENTITY_TYPES = new Set(["shipment", "product", "order", "docai"]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit (keyed by userId when authenticated, IP fallback) ──────────
  const rateLimitKey = session.user?.id
    ? `upload:user:${session.user.id}`
    : `upload:ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
  const rateCheck = await rateLimiter.check(rateLimitKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await resolveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  }

  // Verify the user is a member of this tenant
  const isMember =
    session.user.isSuperadmin || session.user.tenants.some((t) => t.tenantId === tenant.tenantId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fileName, mimeType, entityType, entityId, fileSize } = body;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!fileName || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: `Entity type "${entityType}" is not allowed` },
        { status: 400 }
      );
    }

    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `File type "${mimeType}" is not allowed` },
        { status: 415 }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // ── Entity ownership check ──────────────────────────────────────────────
    // Verify the entityId actually exists in this tenant's DB before handing
    // out a presigned URL — prevents cross-tenant path pollution in MinIO.
    // Portal users with a portalClientId can only upload for their own client's entities.
    if (entityType !== "docai") {
      const { getTenantDb } = await import("@/lib/db/tenant-client");
      const db = getTenantDb(tenant.dbSchema);

      // Resolve portalClientId from JWT for portal-scoped uploads
      const userTenant = session.user.tenants.find(
        (t: { tenantId: string }) => t.tenantId === tenant.tenantId
      );
      const portalClientId = (userTenant as { portalClientId?: string | null } | undefined)
        ?.portalClientId;

      let exists = false;
      if (entityType === "shipment") {
        const shipmentWhere: Record<string, unknown> = { id: entityId };
        if (portalClientId) shipmentWhere.order = { clientId: portalClientId };
        exists = !!(await db.shipment.findFirst({ where: shipmentWhere, select: { id: true } }));
      } else if (entityType === "product") {
        const where: Record<string, unknown> = { id: entityId };
        if (portalClientId) where.clientId = portalClientId;
        exists = !!(await db.product.findFirst({ where, select: { id: true } }));
      } else if (entityType === "order") {
        const where: Record<string, unknown> = { id: entityId };
        if (portalClientId) where.clientId = portalClientId;
        exists = !!(await db.order.findFirst({ where, select: { id: true } }));
      }
      if (!exists) {
        return NextResponse.json({ error: "Entity not found" }, { status: 404 });
      }
    }

    // Sanitize extension
    const rawExt = fileName.split(".").pop() || "bin";
    const ext = rawExt
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 10);

    const key = `${entityType}/${entityId}/${uuid()}.${ext}`;

    await ensureBucket();
    const uploadUrl = await getPresignedUploadUrl(key);
    const publicUrl = process.env.S3_PUBLIC_URL;

    return NextResponse.json({
      uploadUrl,
      key,
      fileUrl: publicUrl
        ? `${publicUrl}/${process.env.S3_BUCKET || "armstrong-wms"}/${key}`
        : `/${key}`,
    });
  } catch (error: unknown) {
    console.error("[API /uploads] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
