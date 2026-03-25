"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailField } from "@/components/auth/auth-fields";
import { requestPasswordReset } from "@/modules/auth/actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email, locale);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.message ?? t("success"));
      }
    } catch {
      setError(t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error ? (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                {success}
              </div>
            ) : null}

            <EmailField
              id="forgot-password-email"
              label={t("email")}
              value={email}
              onChange={(value) => {
                setEmail(value);
                setError(null);
              }}
              placeholder={t("emailPlaceholder")}
              required
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("sending") : t("submit")}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("backToLogin")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
