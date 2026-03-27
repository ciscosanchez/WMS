"use server";

import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { publicDb } from "@/lib/db/public-client";
import { getAppBaseUrl } from "@/lib/app-runtime";
import { sendPasswordResetLink } from "@/lib/email/resend";
import { RateLimiter } from "@/lib/security/rate-limit";

const forgotPasswordLimiter = new RateLimiter(3, 60 * 60_000);
const resetPasswordLimiter = new RateLimiter(5, 60 * 60_000);
const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists with that email, a reset link has been sent.";

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function requestPasswordReset(
  email: string,
  locale?: string
): Promise<{ error?: string; message?: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { error: "Email is required." };
  }

  const { allowed } = await forgotPasswordLimiter.check(`forgot-password:${normalizedEmail}`);
  if (!allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const user = await publicDb.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      tenantUsers: {
        include: { tenant: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const passwordSetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await publicDb.user.update({
    where: { id: user.id },
    data: {
      passwordSetToken: tokenHash,
      passwordSetExpires,
    },
  });

  const baseUrl = getAppBaseUrl();
  const resetPasswordUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  const tenantLocale = (user.tenantUsers[0]?.tenant?.settings as Record<string, unknown> | null)
    ?.locale;

  await sendPasswordResetLink({
    to: user.email,
    name: user.name,
    resetPasswordUrl,
    locale: user.locale ?? (typeof tenantLocale === "string" ? tenantLocale : locale),
  });

  return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
}

export async function resetPasswordWithToken(opts: {
  email: string;
  token: string;
  password: string;
}): Promise<{ error?: string; message?: string }> {
  const email = normalizeEmail(opts.email);
  const token = opts.token.trim();
  const password = opts.password;

  if (!email || !token || !password) {
    return { error: "Email, token, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { allowed } = await resetPasswordLimiter.check(`reset-password:${email}`);
  if (!allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const user = await publicDb.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordSetToken: true,
      passwordSetExpires: true,
    },
  });

  if (!user?.passwordSetToken) {
    return { error: "Invalid or expired reset link." };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (user.passwordSetToken !== tokenHash) {
    return { error: "Invalid or expired reset link." };
  }
  if (user.passwordSetExpires && user.passwordSetExpires < new Date()) {
    return { error: "Invalid or expired reset link." };
  }

  const passwordHash = await hash(password, 12);

  await publicDb.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSetToken: null,
      passwordSetExpires: null,
      authVersion: { increment: 1 },
    },
  });

  await publicDb.session.deleteMany({ where: { userId: user.id } });

  return { message: "Password has been reset. Please log in with your new password." };
}
