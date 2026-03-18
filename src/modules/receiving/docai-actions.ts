"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { extractForReceipt } from "@/lib/integrations/docai";
import type { ExtractForReceiptResponse, ShipmentData } from "@/lib/integrations/docai";
import { getS3Client, getPresignedDownloadUrl } from "@/lib/s3/client";
import { PDFDocument } from "pdf-lib";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

/**
 * Upload a document and send it to DocAI for extraction.
 * Creates a DocumentProcessingJob in "processing" status, calls DocAI,
 * then updates the job with results.
 */
export async function processDocument(opts: {
  fileKey: string;
  fileName: string;
  mimeType: string;
  sourceType: "upload" | "email" | "camera" | "scanner";
  shipmentId?: string;
  clientName?: string;
}): Promise<{ error: string } | Record<string, unknown>> {
  if (config.useMockData) {
    return {
      id: "mock-job",
      status: "completed" as const,
      extractedData: null,
      confidence: 0.95,
    };
  }

  try {

  const { user, tenant } = await getContext();

  // Create the processing job
  const job = await tenant.db.documentProcessingJob.create({
    data: {
      sourceType: opts.sourceType,
      status: "processing",
      fileUrl: opts.fileKey,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      tenantId: tenant.tenantId,
      ...(opts.shipmentId && {
        document: {
          create: {
            type: "other",
            fileName: opts.fileName,
            fileUrl: opts.fileKey,
            entityType: "shipment",
            entityId: opts.shipmentId,
            uploadedBy: user.id,
          },
        },
      }),
    },
  });

  // Fetch the file from S3 and convert to base64
  let result: ExtractForReceiptResponse;
  try {
    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET || "armstrong-wms";
    const stream = await s3.getObject(bucket, opts.fileKey);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const fileBase64 = Buffer.concat(chunks).toString("base64");

    result = await extractForReceipt({
      fileBase64,
      mimeType: opts.mimeType,
      tenantId: tenant.tenantId,
      context: {
        clientName: opts.clientName,
      },
    });
  } catch (err) {
    // Mark job as failed
    await tenant.db.documentProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        processedAt: new Date(),
      },
    });
    return { error: err instanceof Error ? err.message : "Document processing failed" };
  }

  // Update job with extraction results
  const updated = await tenant.db.documentProcessingJob.update({
    where: { id: job.id },
    data: {
      status: "review",
      documentType: result.sourceDocumentType,
      extractedData: JSON.parse(JSON.stringify(result.receipt)),
      confidence: result.overallConfidence,
      aiModel: "claude-sonnet",
      aiCost: result.usage?.estimatedCostUsd ?? null,
      requestId: result.requestId,
      processedAt: new Date(),
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "document_processing_job",
    entityId: job.id,
  });

  revalidatePath("/receiving");
  return updated;
  } catch (outerErr) {
    return { error: outerErr instanceof Error ? outerErr.message : "Unexpected error" };
  }
}

/**
 * Get a processing job by ID.
 */
export async function getProcessingJob(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.documentProcessingJob.findUnique({
    where: { id },
    include: { document: true },
  });
}

/**
 * Get all processing jobs for a shipment.
 */
export async function getProcessingJobsForShipment(shipmentId: string) {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.documentProcessingJob.findMany({
    where: {
      document: { entityId: shipmentId, entityType: "shipment" },
    },
    include: { document: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get recent processing jobs (for the doc processing queue view).
 */
export async function getRecentJobs(limit = 20) {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.documentProcessingJob.findMany({
    take: limit,
    include: { document: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Save human-reviewed corrections to extracted data.
 */
export async function saveReview(jobId: string, reviewedData: Record<string, unknown>) {
  if (config.useMockData) return { id: jobId, status: "completed" };

  const { user, tenant } = await getContext();

  const job = await tenant.db.documentProcessingJob.update({
    where: { id: jobId },
    data: {
      reviewedData: JSON.parse(JSON.stringify(reviewedData)),
      reviewedBy: user.id,
      reviewedAt: new Date(),
      status: "completed",
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "document_processing_job",
    entityId: jobId,
    changes: { status: { old: "review", new: "completed" } },
  });

  revalidatePath("/receiving");
  return job;
}

/**
 * Create a shipment from reviewed extraction data.
 * Takes the reviewed (or original extracted) data and creates an InboundShipment.
 */
export async function createShipmentFromExtraction(jobId: string, clientId: string) {
  if (config.useMockData) {
    return { id: "mock-new", shipmentNumber: "ASN-MOCK-0001" };
  }

  const { user, tenant } = await getContext();

  const job = await tenant.db.documentProcessingJob.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error("Processing job not found");
  if (job.status !== "review" && job.status !== "completed") {
    throw new Error(`Cannot create shipment from job in "${job.status}" status`);
  }

  // Use reviewed data if available, otherwise use extracted data
  const data = (job.reviewedData ?? job.extractedData) as unknown as ShipmentData | null;
  if (!data) throw new Error("No extraction data available");

  const shipmentNumber = await nextSequence(tenant.db, "ASN");

  const shipment = await tenant.db.inboundShipment.create({
    data: {
      shipmentNumber,
      clientId,
      status: "draft",
      carrier: data.carrier?.value || null,
      trackingNumber: data.trackingNumber?.value || null,
      bolNumber: data.proNumber?.value || null,
      poNumber: data.poNumbers?.value?.[0] || null,
    },
  });

  // Link the job to the created shipment
  await tenant.db.documentProcessingJob.update({
    where: { id: jobId },
    data: {
      resultType: "shipment",
      resultId: shipment.id,
      status: "completed",
    },
  });

  // Attach document to shipment — create if it wasn't created yet (Smart Receiving flow)
  if (job.documentId) {
    await tenant.db.document.update({
      where: { id: job.documentId },
      data: { entityId: shipment.id, entityType: "shipment" },
    });
  } else {
    await tenant.db.document.create({
      data: {
        type: job.documentType || "other",
        fileName: job.fileName,
        fileUrl: job.fileUrl,
        mimeType: job.mimeType || undefined,
        entityType: "shipment",
        entityId: shipment.id,
        uploadedBy: user.id,
        processingJobs: { connect: { id: job.id } },
      },
    });
  }

  // Auto-create line items from extracted data by matching SKU
  const lineItems = data.lineItems?.value ?? [];
  if (lineItems.length > 0) {
    const skus = lineItems.map((item) => item.sku).filter(Boolean) as string[];
    const products = skus.length > 0
      ? await tenant.db.product.findMany({
          where: { clientId, sku: { in: skus } },
          select: { id: true, sku: true },
        })
      : [];
    const productBySku = new Map(products.map((p) => [p.sku, p.id]));

    const linesToCreate = lineItems
      .filter((item) => item.sku && productBySku.has(item.sku))
      .map((item) => ({
        shipmentId: shipment.id,
        productId: productBySku.get(item.sku!)!,
        expectedQty: item.quantity ?? item.pieces ?? 1,
        uom: item.uom || "EA",
      }));

    if (linesToCreate.length > 0) {
      await tenant.db.inboundShipmentLine.createMany({ data: linesToCreate });
    }
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inbound_shipment",
    entityId: shipment.id,
  });

  revalidatePath("/receiving");
  return shipment;
}

/**
 * Get a presigned download URL for a file (server action wrapper).
 */
export async function getFileViewUrl(fileKey: string): Promise<string | null> {
  try {
    return await getPresignedDownloadUrl(fileKey);
  } catch {
    return null;
  }
}

/**
 * Merge all documents and photos for a shipment into a single master PDF.
 * Downloads each file from S3, embeds PDFs/images, uploads the result,
 * and creates a Document record of type "master_pdf".
 */
export async function finalizeShipmentPdf(
  shipmentId: string
): Promise<{ error: string } | { documentId: string; fileKey: string }> {
  try {
    const { user, tenant } = await getContext();

    const documents = await tenant.db.document.findMany({
      where: { entityId: shipmentId, entityType: "shipment" },
      orderBy: { uploadedAt: "asc" },
    });

    if (documents.length === 0) {
      return { error: "No documents found for this shipment" };
    }

    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET || "armstrong-wms";
    const merged = await PDFDocument.create();

    for (const doc of documents) {
      // Skip already-generated master PDFs to avoid recursion
      if (doc.type === "master_pdf") continue;

      let fileBuffer: Buffer;
      try {
        const stream = await s3.getObject(bucket, doc.fileUrl);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        fileBuffer = Buffer.concat(chunks);
      } catch {
        // Skip files that can't be fetched
        continue;
      }

      const mime = doc.mimeType || "";

      if (mime === "application/pdf") {
        try {
          const src = await PDFDocument.load(fileBuffer);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        } catch {
          // Corrupted PDF — skip
        }
      } else if (mime === "image/jpeg" || mime === "image/jpg") {
        try {
          const img = await merged.embedJpg(fileBuffer);
          const page = merged.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } catch {
          // Skip
        }
      } else if (mime === "image/png") {
        try {
          const img = await merged.embedPng(fileBuffer);
          const page = merged.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } catch {
          // Skip
        }
      }
      // Other types (xlsx, csv, etc.) are skipped
    }

    if (merged.getPageCount() === 0) {
      return { error: "No PDF or image documents could be merged" };
    }

    const pdfBytes = await merged.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const timestamp = Date.now();
    const fileKey = `shipment/${shipmentId}/master-${timestamp}.pdf`;

    await s3.putObject(bucket, fileKey, pdfBuffer, pdfBuffer.length, {
      "Content-Type": "application/pdf",
    });

    const masterDoc = await tenant.db.document.create({
      data: {
        type: "master_pdf",
        fileName: `master-${timestamp}.pdf`,
        fileUrl: fileKey,
        mimeType: "application/pdf",
        fileSize: pdfBuffer.length,
        entityType: "shipment",
        entityId: shipmentId,
        uploadedBy: user.id,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "document",
      entityId: masterDoc.id,
    });

    revalidatePath(`/receiving/${shipmentId}`);
    return { documentId: masterDoc.id, fileKey };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate master PDF" };
  }
}
