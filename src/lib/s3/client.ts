import * as Minio from "minio";

const globalForMinio = globalThis as unknown as {
  minioClient: Minio.Client | undefined;
};

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

const BUCKET = process.env.S3_BUCKET || "armstrong-wms";

export async function getPresignedUploadUrl(key: string, expiry = 3600): Promise<string> {
  const client = getS3Client();
  return client.presignedPutObject(BUCKET, key, expiry);
}

export async function getPresignedDownloadUrl(key: string, expiry = 3600): Promise<string> {
  const client = getS3Client();
  return client.presignedGetObject(BUCKET, key, expiry);
}

export async function ensureBucket() {
  const client = getS3Client();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
  }
}
