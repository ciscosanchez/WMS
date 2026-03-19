import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, ensureBucket } from "@/lib/s3/client";
import { getSession } from "@/lib/auth/session";
import { resolveTenant } from "@/lib/tenant/context";
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

const ALLOWED_ENTITY_TYPES = new Set([
  "shipment",
  "product",
  "order",
  "docai",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await resolveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  }

  // Verify the user is a member of this tenant
  const isMember =
    session.user.isSuperadmin ||
    session.user.tenants.some((t) => t.tenantId === tenant.tenantId);
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
    if (entityType !== "docai") {
      const { getTenantDb } = await import("@/lib/db/tenant-client");
      const db = getTenantDb(tenant.dbSchema);
      let exists = false;
      if (entityType === "shipment") {
        exists = !!(await db.shipment.findFirst({ where: { id: entityId }, select: { id: true } }));
      } else if (entityType === "product") {
        exists = !!(await db.product.findFirst({ where: { id: entityId }, select: { id: true } }));
      } else if (entityType === "order") {
        exists = !!(await db.order.findFirst({ where: { id: entityId }, select: { id: true } }));
      }
      if (!exists) {
        return NextResponse.json({ error: "Entity not found" }, { status: 404 });
      }
    }

    // Sanitize extension
    const rawExt = fileName.split(".").pop() || "bin";
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
