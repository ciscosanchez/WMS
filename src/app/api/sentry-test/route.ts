import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await Sentry.captureException(new Error("Sentry test error from wms prod"));
  await Sentry.flush(2000);
  return NextResponse.json({ ok: true, message: "Sentry test event sent" });
}
