import { NextRequest } from "next/server";
import { exportTenantAccessReviewCsv } from "@/modules/users/actions";

export async function GET(_request: NextRequest) {
  try {
    return await exportTenantAccessReviewCsv();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
