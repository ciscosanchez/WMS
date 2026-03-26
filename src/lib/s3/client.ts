import * as Minio from "minio";

const globalForMinio = globalThis as unknown as {
  minioClient: Minio.Client | undefined;
  minioPresignClient: Minio.Client | undefined;
};

// Internal client — connects directly to MinIO container for server-side operations
export function getS3Client(): Minio.Client {
  if (globalForMinio.minioClient) return globalForMinio.minioClient;

  const client = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT!,
    port: parseInt(process.env.S3_PORT || "9000"),
    useSSL: process.env.S3_USE_SSL === "true",
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMinio.minioClient = client;
  }

  return client;
}

// Presign client — uses the public URL so signatures match browser PUT requests
function getPresignClient(): Minio.Client {
  if (globalForMinio.minioPresignClient) return globalForMinio.minioPresignClient;

  const publicUrl = process.env.S3_PUBLIC_URL;
  if (publicUrl) {
    const parsed = new URL(publicUrl);
    const client = new Minio.Client({
      endPoint: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
      useSSL: parsed.protocol === "https:",
      accessKey: process.env.S3_ACCESS_KEY!,
      secretKey: process.env.S3_SECRET_KEY!,
    });
    if (process.env.NODE_ENV !== "production") {
      globalForMinio.minioPresignClient = client;
    }
    return client;
  }

  return getS3Client();
}

const BUCKET = process.env.S3_BUCKET || "ramola-wms";

export async function getPresignedUploadUrl(key: string, expiry = 3600): Promise<string> {
  return getPresignClient().presignedPutObject(BUCKET, key, expiry);
}

export async function getPresignedDownloadUrl(key: string, expiry = 3600): Promise<string> {
  return getPresignClient().presignedGetObject(BUCKET, key, expiry);
}

export async function ensureBucket() {
  const client = getS3Client();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
  }
}

/**
 * Upload a Buffer directly to MinIO.
 * Returns the stored object key.
 */
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  await ensureBucket();
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return key;
}

/**
 * Delete an object from MinIO (e.g. when voiding a label).
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  await client.removeObject(BUCKET, key);
}
