/**
 * Unified notification helper: sends both in-app + email.
 * All notifications are fire-and-forget — they never block the calling action.
 */

import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import { createNotification } from "./index";
import { publicDb } from "@/lib/db/public-client";
import type { SendResult } from "@/lib/email/resend";

interface NotifyOpts {
  tenantId: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  link?: string;
  /** Called once per recipient email. Return value is logged but not blocking. */
  emailFn?: (email: string) => Promise<SendResult>;
}

/**
 * Notify all admins + managers for a tenant.
 * Creates in-app notifications and optionally sends emails.
 */
export async function notifyWarehouseTeam(db: PrismaClient, opts: NotifyOpts): Promise<void> {
  try {
    // Get all admin + manager users for this tenant
    const tenantUsers = await publicDb.tenantUser.findMany({
      where: {
        tenantId: opts.tenantId,
        role: { in: ["admin", "manager"] },
      },
      include: { user: { select: { id: true, email: true } } },
    });

    // Create in-app notification for each user
    await Promise.all(
      tenantUsers.map((tu) =>
        createNotification(db, {
          userId: tu.user.id,
          title: opts.title,
          message: opts.message,
          type: opts.type ?? "info",
          link: opts.link,
        }).catch((err) => {
          console.error(`[notify] Failed to create in-app notification for ${tu.user.email}:`, err);
        })
      )
    );

    // Send email to each user if emailFn provided
    if (opts.emailFn) {
      await Promise.all(
        tenantUsers.map((tu) =>
          opts.emailFn!(tu.user.email).catch((err) => {
            console.error(`[notify] Failed to send email to ${tu.user.email}:`, err);
          })
        )
      );
    }
  } catch (err) {
    // Never throw — notifications must not block the calling action
    console.error("[notify] Failed to send notifications:", err);
  }
}
