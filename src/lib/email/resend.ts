/**
 * Email sender via Resend.
 * Set RESEND_API_KEY in env to enable. If not set, emails are skipped
 * and the caller receives a warning — useful for local dev.
 */
import { Resend } from "resend";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM || "Ramola WMS <noreply@wms.ramola.app>";

export interface SendResult {
  sent: boolean;
  warning?: string;
}

export async function sendUserInvite(opts: {
  to: string;
  name: string;
  tenantName: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return {
      sent: false,
      warning: "RESEND_API_KEY not set — email skipped. Share credentials manually.",
    };
  }

  const roleLabel = opts.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `You've been invited to ${opts.tenantName} on Ramola WMS`,
    html: `
      <p>Hi ${opts.name},</p>
      <p>You've been invited to <strong>${opts.tenantName}</strong> on Ramola WMS as a <strong>${roleLabel}</strong>.</p>
      <p>Your temporary credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${opts.to}</li>
        <li><strong>Temporary password:</strong> <code>${opts.tempPassword}</code></li>
      </ul>
      <p><a href="${opts.loginUrl}">Log in and change your password →</a></p>
      <p style="color:#888;font-size:12px;">This invite was sent from Ramola WMS. If you weren't expecting this, you can ignore it.</p>
    `,
  });

  return { sent: true };
}

// ── Warehouse notification emails ───────────────────────────────────────────

const NO_KEY: SendResult = { sent: false, warning: "RESEND_API_KEY not set — email skipped." };

export async function sendShipmentArrived(opts: {
  to: string;
  shipmentNumber: string;
  clientName: string;
  expectedUnits: number;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Shipment ${opts.shipmentNumber} has arrived`,
    html: `
      <p>Shipment <strong>${opts.shipmentNumber}</strong> from <strong>${opts.clientName}</strong> has arrived at the dock.</p>
      <p><strong>${opts.expectedUnits}</strong> units expected.</p>
      <p style="color:#888;font-size:12px;">Ramola WMS</p>
    `,
  });
  return { sent: true };
}

export async function sendReceivingCompleted(opts: {
  to: string;
  shipmentNumber: string;
  totalUnits: number;
  totalCartons: number;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Receiving complete: ${opts.shipmentNumber}`,
    html: `
      <p>Shipment <strong>${opts.shipmentNumber}</strong> receiving is complete.</p>
      <ul>
        <li><strong>${opts.totalUnits}</strong> units received</li>
        <li><strong>${opts.totalCartons}</strong> cartons scanned</li>
      </ul>
      <p style="color:#888;font-size:12px;">Ramola WMS</p>
    `,
  });
  return { sent: true };
}

export async function sendOrderShipped(opts: {
  to: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Order ${opts.orderNumber} shipped via ${opts.carrier}`,
    html: `
      <p>Order <strong>${opts.orderNumber}</strong> has been shipped.</p>
      <ul>
        <li><strong>Carrier:</strong> ${opts.carrier}</li>
        <li><strong>Tracking:</strong> ${opts.trackingNumber}</li>
      </ul>
      <p style="color:#888;font-size:12px;">Ramola WMS</p>
    `,
  });
  return { sent: true };
}

export async function sendOrderShippedCustomer(opts: {
  to: string;
  customerName: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your order ${opts.orderNumber} has shipped!`,
    html: `
      <p>Hi ${opts.customerName},</p>
      <p>Your order <strong>${opts.orderNumber}</strong> has been shipped!</p>
      <ul>
        <li><strong>Carrier:</strong> ${opts.carrier}</li>
        <li><strong>Tracking number:</strong> ${opts.trackingNumber}</li>
      </ul>
      <p>You can track your package using the tracking number above on the carrier's website.</p>
      <p style="color:#888;font-size:12px;">Shipped by Ramola WMS</p>
    `,
  });
  return { sent: true };
}

export async function sendLowStockAlert(opts: {
  to: string;
  products: { sku: string; name: string; available: number; minStock: number }[];
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const rows = opts.products
    .map((p) => `<tr><td>${p.sku}</td><td>${p.name}</td><td style="color:red;font-weight:bold">${p.available}</td><td>${p.minStock}</td></tr>`)
    .join("");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Low stock alert: ${opts.products.length} product(s) below minimum`,
    html: `
      <p><strong>${opts.products.length}</strong> product(s) are below their minimum stock level:</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr style="background:#f5f5f5"><th>SKU</th><th>Name</th><th>Available</th><th>Min Stock</th></tr>
        ${rows}
      </table>
      <p style="color:#888;font-size:12px;">Ramola WMS</p>
    `,
  });
  return { sent: true };
}
