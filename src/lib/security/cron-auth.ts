/**
 * HMAC-SHA256 authentication for cron endpoints.
 *
 * When CRON_HMAC_ENABLED=1 the caller must send:
 *   x-cron-signature  = HMAC-SHA256( CRON_SECRET, "<timestamp>:<path>" )
 *   x-cron-timestamp  = Unix-epoch seconds string
 *
 * The timestamp must be within 60 seconds of server time (replay protection).
 *
 * When CRON_HMAC_ENABLED is unset, falls back to the legacy simple-secret
 * check (x-cron-secret header or ?secret= query param) for backward compat.
 */

import crypto from "crypto";
import { NextRequest } from "next/server";

const MAX_AGE_SECONDS = 60;

/**
 * Timing-safe comparison of two strings.
 * Returns false immediately if lengths differ (unavoidable) but uses
 * `timingSafeEqual` for same-length buffers so the comparison time is
 * constant regardless of where the first mismatch occurs.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify an incoming cron request.
 *
 * Returns `true` when the request is authentic, `false` otherwise.
 */
export function verifyCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  // ── HMAC mode ──────────────────────────────────────────────────────────
  if (process.env.CRON_HMAC_ENABLED === "1") {
    const signature = req.headers.get("x-cron-signature");
    const timestampHeader = req.headers.get("x-cron-timestamp");

    if (!signature || !timestampHeader) return false;

    // Replay protection: reject timestamps older than MAX_AGE_SECONDS
    const timestamp = parseInt(timestampHeader, 10);
    if (Number.isNaN(timestamp)) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > MAX_AGE_SECONDS) return false;

    // Compute expected HMAC over "timestamp:path"
    const path = req.nextUrl.pathname;
    const expected = crypto
      .createHmac("sha256", cronSecret)
      .update(`${timestampHeader}:${path}`)
      .digest("hex");

    return timingSafeCompare(expected, signature);
  }

  // ── Legacy simple-secret mode (backward compat) ────────────────────────
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");

  if (!secret) return false;

  return timingSafeCompare(cronSecret, secret);
}
