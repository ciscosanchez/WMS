"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { setPasswordWithToken } from "@/modules/users/actions";

export function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const t = useTranslations("auth.setPassword");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("minLength"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await setPasswordWithToken(token, password);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("success"));
        router.push("/login");
      }
    } catch {
      toast.error(t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{t("invalidLink")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="password"
              label={t("password")}
              value={password}
              onChange={setPassword}
              placeholder={t("passwordPlaceholder")}
              minLength={8}
              required
              autoComplete="new-password"
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
            />
            <PasswordField
              id="confirm"
              label={t("confirmPassword")}
              value={confirm}
              onChange={setConfirm}
              placeholder={t("confirmPlaceholder")}
              required
              autoComplete="new-password"
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("settingPassword") : t("setPassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
