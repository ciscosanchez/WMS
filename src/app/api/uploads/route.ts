import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, ensureBucket } from "@/lib/s3/client";
import { v4 as uuid } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, mimeType: _mimeType, entityType, entityId } = body;

    if (!fileName || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ext = fileName.split(".").pop() || "bin";
    const key = `${entityType}/${entityId}/${uuid()}.${ext}`;

    await ensureBucket();
    let uploadUrl = await getPresignedUploadUrl(key);

    // Rewrite internal MinIO hostname to public URL for browser uploads
    const publicUrl = process.env.S3_PUBLIC_URL;
    if (publicUrl) {
      const internal = `http://${process.env.S3_ENDPOINT}:${process.env.S3_PORT || "9000"}`;
      uploadUrl = uploadUrl.replace(internal, publicUrl);
    }

    return NextResponse.json({
      uploadUrl,
      key,
      fileUrl: publicUrl ? `${publicUrl}/${process.env.S3_BUCKET || "armstrong-wms"}/${key}` : `/${key}`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
