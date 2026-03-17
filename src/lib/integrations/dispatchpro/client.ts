/**
 * DispatchPro TMS client — WMS → DispatchPro outbound calls.
 * Triggered when a WMS order transitions to "packed" (ready to ship).
 */

const DISPATCH_URL = process.env.DISPATCH_PRO_URL ?? "http://dispatch:3001";
const DISPATCH_API_KEY = process.env.DISPATCH_PRO_API_KEY ?? "";

export interface DispatchOrderPayload {
  tenantSlug: string;
  wmsOrderId: string;
  wmsOrderNumber: string;
  customer: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  items: Array<{
    sku: string;
    description: string;
    quantity: number;
    weight?: number;
  }>;
}

export interface DispatchOrderResult {
  orderId: string;
  status: string;
}

export async function createDispatchOrder(
  payload: DispatchOrderPayload
): Promise<{ error: string } | DispatchOrderResult> {
  if (!DISPATCH_API_KEY) {
    return { error: "DISPATCH_PRO_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${DISPATCH_URL}/api/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": DISPATCH_API_KEY,
      },
      body: JSON.stringify({
        action: "create_order",
        tenantSlug: payload.tenantSlug,
        data: {
          wmsOrderId: payload.wmsOrderId,
          wmsOrderNumber: payload.wmsOrderNumber,
          customer: payload.customer,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          zip: payload.zip,
          items: payload.items,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `DispatchPro ${res.status}: ${text}` };
    }

    return (await res.json()) as DispatchOrderResult;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reach DispatchPro" };
  }
}
