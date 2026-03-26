/**
 * Email sender via Resend.
 * Set RESEND_API_KEY in env to enable. If not set, emails are skipped
 * and the caller receives a warning — useful for local dev.
 *
 * All email text is loaded from i18n translation files (email.json)
 * so emails are sent in the tenant's locale.
 */
import { Resend } from "resend";
import { getServerTranslations } from "@/i18n/server";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM || "Ramola WMS <noreply@wms.ramola.app>";
const APP_NAME = process.env.APP_NAME || "Ramola WMS";

export interface SendResult {
  sent: boolean;
  warning?: string;
}

const NO_KEY: SendResult = { sent: false, warning: "RESEND_API_KEY not set — email skipped." };

export async function sendUserInvite(opts: {
  to: string;
  name: string;
  tenantName: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return {
      sent: false,
      warning: "RESEND_API_KEY not set — email skipped. Share credentials manually.",
    };
  }

  const t = await getServerTranslations(opts.locale ?? "en", "email");
  const roleLabel = opts.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("invite.subject", { tenantName: opts.tenantName }),
    html: `
      <p>${t("invite.greeting", { name: opts.name })}</p>
      <p>${t("invite.body", { tenantName: opts.tenantName, role: roleLabel })}</p>
      <p>${t("invite.credentials")}</p>
      <ul>
        <li><strong>${t("invite.emailLabel")}</strong> ${opts.to}</li>
        <li><strong>${t("invite.tempPasswordLabel")}</strong> <code>${opts.tempPassword}</code></li>
      </ul>
      <p><a href="${opts.loginUrl}">${t("invite.loginLink")}</a></p>
      <p style="color:#888;font-size:12px;">${t("invite.footer")}</p>
    `,
  });

  return { sent: true };
}

export async function sendPasswordSetLink(opts: {
  to: string;
  name: string;
  tenantName: string;
  role: string;
  setPasswordUrl: string;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return { sent: false, warning: "RESEND_API_KEY not set — email skipped." };
  }

  const t = await getServerTranslations(opts.locale ?? "en", "email");
  const roleLabel = opts.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("setPassword.subject", { tenantName: opts.tenantName }),
    html: `
      <p>${t("setPassword.greeting", { name: opts.name })}</p>
      <p>${t("setPassword.body", { tenantName: opts.tenantName, role: roleLabel })}</p>
      <p>${t("setPassword.instruction")}</p>
      <p><a href="${opts.setPasswordUrl}" style="display:inline-block;padding:10px 24px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">${t("setPassword.buttonText")}</a></p>
      <p style="color:#888;font-size:12px;">${t("setPassword.footer")}</p>
    `,
  });

  return { sent: true };
}

export async function sendPasswordResetLink(opts: {
  to: string;
  name: string;
  resetPasswordUrl: string;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return { sent: false, warning: "RESEND_API_KEY not set — email skipped." };
  }

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("passwordReset.subject"),
    html: `
      <p>${t("passwordReset.greeting", { name: opts.name })}</p>
      <p>${t("passwordReset.body")}</p>
      <p><a href="${opts.resetPasswordUrl}" style="display:inline-block;padding:10px 24px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">${t("passwordReset.buttonText")}</a></p>
      <p style="color:#888;font-size:12px;">${t("passwordReset.footer")}</p>
    `,
  });

  return { sent: true };
}

// ── Warehouse notification emails ───────────────────────────────────────────

export async function sendShipmentArrived(opts: {
  to: string;
  shipmentNumber: string;
  clientName: string;
  expectedUnits: number;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("shipmentArrived.subject", { shipmentNumber: opts.shipmentNumber }),
    html: `
      <p>${t("shipmentArrived.body", { shipmentNumber: opts.shipmentNumber, clientName: opts.clientName })}</p>
      <p>${t("shipmentArrived.unitsExpected", { count: opts.expectedUnits })}</p>
      <p style="color:#888;font-size:12px;">${APP_NAME}</p>
    `,
  });
  return { sent: true };
}

export async function sendReceivingCompleted(opts: {
  to: string;
  shipmentNumber: string;
  totalUnits: number;
  totalCartons: number;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("receivingCompleted.subject", { shipmentNumber: opts.shipmentNumber }),
    html: `
      <p>${t("receivingCompleted.body", { shipmentNumber: opts.shipmentNumber })}</p>
      <ul>
        <li>${t("receivingCompleted.unitsReceived", { count: opts.totalUnits })}</li>
        <li>${t("receivingCompleted.cartonsScanned", { count: opts.totalCartons })}</li>
      </ul>
      <p style="color:#888;font-size:12px;">${APP_NAME}</p>
    `,
  });
  return { sent: true };
}

export async function sendOrderShipped(opts: {
  to: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("orderShipped.subject", { orderNumber: opts.orderNumber, carrier: opts.carrier }),
    html: `
      <p>${t("orderShipped.body", { orderNumber: opts.orderNumber })}</p>
      <ul>
        <li><strong>${t("orderShipped.carrier")}</strong> ${opts.carrier}</li>
        <li><strong>${t("orderShipped.tracking")}</strong> ${opts.trackingNumber}</li>
      </ul>
      <p style="color:#888;font-size:12px;">${APP_NAME}</p>
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
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("orderShippedCustomer.subject", { orderNumber: opts.orderNumber }),
    html: `
      <p>${t("orderShippedCustomer.greeting", { name: opts.customerName })}</p>
      <p>${t("orderShippedCustomer.body", { orderNumber: opts.orderNumber })}</p>
      <ul>
        <li><strong>${t("orderShippedCustomer.carrier")}</strong> ${opts.carrier}</li>
        <li><strong>${t("orderShippedCustomer.tracking")}</strong> ${opts.trackingNumber}</li>
      </ul>
      <p>${t("orderShippedCustomer.trackingHelp")}</p>
      <p style="color:#888;font-size:12px;">${t("orderShippedCustomer.footer")}</p>
    `,
  });
  return { sent: true };
}

export async function sendLowStockAlert(opts: {
  to: string;
  products: { sku: string; name: string; available: number; minStock: number }[];
  locale?: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return NO_KEY;

  const t = await getServerTranslations(opts.locale ?? "en", "email");

  const rows = opts.products
    .map(
      (p) =>
        `<tr><td>${p.sku}</td><td>${p.name}</td><td style="color:red;font-weight:bold">${p.available}</td><td>${p.minStock}</td></tr>`
    )
    .join("");

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: t("lowStock.subject", { count: opts.products.length }),
    html: `
      <p>${t("lowStock.body", { count: opts.products.length })}</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr style="background:#f5f5f5"><th>${t("lowStock.sku")}</th><th>${t("lowStock.name")}</th><th>${t("lowStock.available")}</th><th>${t("lowStock.minStock")}</th></tr>
        ${rows}
      </table>
      <p style="color:#888;font-size:12px;">${APP_NAME}</p>
    `,
  });
  return { sent: true };
}
