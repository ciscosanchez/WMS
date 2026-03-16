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
    const uploadUrl = await getPresignedUploadUrl(key);

    return NextResponse.json({
      uploadUrl,
      key,
      fileUrl: `/${key}`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
