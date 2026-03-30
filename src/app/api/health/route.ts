/**
 * Health Check Endpoint
 *
 * No auth required — intended for load balancer probes and uptime monitors.
 *
 * Checks:
 *  - PostgreSQL connectivity (simple query via publicDb)
 *  - Redis connectivity (ping)
 *  - MinIO/S3 connectivity (bucket exists check)
 *
 * Returns:
 *  - 200 with status "healthy" when all checks pass
 *  - 200 with status "degraded" when some checks fail
 *  - 503 with status "unhealthy" when critical checks (DB) fail
 */

import { NextResponse } from "next/server";

const startTime = Date.now();
const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || "0.1.0";

type CheckStatus = "ok" | "error";

type CheckResult = {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
};

type HealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    db: CheckResult;
    redis: CheckResult;
    s3: CheckResult;
  };
  uptime: number;
  version: string;
};

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { publicDb } = await import("@/lib/db/public-client");
    await publicDb.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "DB connection failed",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { getRedis } = await import("@/lib/redis/client");
    const client = getRedis();
    await client.ping();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Redis connection failed",
    };
  }
}

async function checkS3(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { getS3Client } = await import("@/lib/s3/client");
    const client = getS3Client();
    const bucket = process.env.S3_BUCKET || "ramola-wms";
    await client.bucketExists(bucket);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "S3 connection failed",
    };
  }
}

export async function GET() {
  const [db, redis, s3] = await Promise.all([checkDb(), checkRedis(), checkS3()]);

  const checks = { db, redis, s3 };
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  // DB is critical — if it's down, the app is unhealthy
  // Redis and S3 are non-critical — if they're down, the app is degraded
  let status: HealthResponse["status"];
  if (db.status === "error") {
    status = "unhealthy";
  } else if (redis.status === "error" || s3.status === "error") {
    status = "degraded";
  } else {
    status = "healthy";
  }

  const body: HealthResponse = {
    status,
    checks,
    uptime: uptimeSeconds,
    version: APP_VERSION,
  };

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(body, { status: httpStatus });
}
