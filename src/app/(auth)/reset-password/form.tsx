"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField } from "@/components/auth/auth-fields";
import { resetPasswordWithToken } from "@/modules/auth/actions";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth.resetPassword");
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !token) {
      setError(t("invalidLink"));
      return;
    }
    if (!password || !confirmPassword) {
      setError(t("required"));
      return;
    }
    if (password.length < 8) {
      setError(t("minLength"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPasswordWithToken({ email, token, password });
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

  if (!email || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">{t("invalidLink")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="grid gap-4">
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                {success}
              </div>
              <Button asChild className="w-full">
                <Link href="/login">{t("backToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              {error ? (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <PasswordField
                id="reset-password"
                label={t("password")}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder={t("passwordPlaceholder")}
                minLength={8}
                required
                autoComplete="new-password"
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((current) => !current)}
              />

              <PasswordField
                id="reset-confirm-password"
                label={t("confirmPassword")}
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setError(null);
                }}
                placeholder={t("confirmPlaceholder")}
                required
                autoComplete="new-password"
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((current) => !current)}
              />

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("resetting") : t("submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
