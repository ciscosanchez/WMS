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
