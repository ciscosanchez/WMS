"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { TenantAuthMode } from "@/lib/auth/tenant-auth";
import { Building2, Warehouse } from "lucide-react";
import { EmailField, PasswordField } from "@/components/auth/auth-fields";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

type SsoDiscoveryResult = {
  tenantSlug: string | null;
  mode: TenantAuthMode;
  sso: Array<{
    id: string;
    label: string;
    startUrl: string;
    type: "oidc" | "saml";
  }>;
};

const DEFAULT_SSO_DISCOVERY: SsoDiscoveryResult = {
  tenantSlug: null,
  mode: "password",
  sso: [],
};

function getSafeRedirectUrl(resultUrl: string | null | undefined, fallbackPath: string) {
  if (!resultUrl) return fallbackPath;

  try {
    const resolved = new URL(resultUrl, window.location.origin);
    return resolved.origin === window.location.origin ? resolved.toString() : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoDiscovery, setSsoDiscovery] = useState<SsoDiscoveryResult | null>(
    USE_MOCK ? DEFAULT_SSO_DISCOVERY : null
  );

  useEffect(() => {
    if (USE_MOCK) return;

    let active = true;
    const callbackUrl = searchParams.get("callbackUrl");

    async function loadSsoDiscovery() {
      try {
        const response = await fetch("/api/auth/sso/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callbackUrl: callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to load sign-in options");
        }

        const result = (await response.json()) as SsoDiscoveryResult;
        if (active) {
          setSsoDiscovery(result);
        }
      } catch {
        if (active) {
          setSsoDiscovery(DEFAULT_SSO_DISCOVERY);
        }
      }
    }

    void loadSsoDiscovery();
    return () => {
      active = false;
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const requestedCallbackUrl = searchParams.get("callbackUrl");
      const callbackUrl =
        requestedCallbackUrl && requestedCallbackUrl.startsWith("/")
          ? requestedCallbackUrl
          : "/dashboard";

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(t("invalidCredentials"));
      } else {
        window.location.assign(getSafeRedirectUrl(result?.url, callbackUrl));
        return;
      }
    } catch {
      setError(t("somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    router.push("/dashboard");
  }

  const passwordAllowed = USE_MOCK || ssoDiscovery?.mode !== "sso_only";
  const ssoOptions = ssoDiscovery?.sso ?? [];
  const showSsoDivider = ssoOptions.length > 0 && passwordAllowed;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Warehouse className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {USE_MOCK && (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <strong>{t("demoMode")}</strong> — {t("demoBypassed")}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-center text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {USE_MOCK ? (
            <Button className="w-full" onClick={handleDemoLogin}>
              {t("continueAsAdmin")}
            </Button>
          ) : !ssoDiscovery ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t("checkingSignIn")}
            </div>
          ) : (
            <div className="grid gap-4">
              {ssoOptions.length > 0 && (
                <div className="grid gap-2">
                  {ssoOptions.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <Link href={provider.startUrl}>
                        <Building2 className="h-4 w-4" />
                        {provider.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              )}

              {showSsoDivider && (
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <Separator className="flex-1" />
                  <span>{t("continueWithEmail")}</span>
                  <Separator className="flex-1" />
                </div>
              )}

              {passwordAllowed ? (
                <form onSubmit={handleSubmit} className="grid gap-4">
                  <EmailField
                    id="email"
                    label={t("email")}
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(value) => {
                      setEmail(value);
                      setError(null);
                    }}
                    required
                  />
                  <PasswordField
                    id="password"
                    label={t("password")}
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      setError(null);
                    }}
                    required
                    autoComplete="current-password"
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword((current) => !current)}
                  />
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("forgotPassword")}
                    </Link>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("signingIn") : t("signIn")}
                  </Button>
                </form>
              ) : ssoOptions.length > 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("ssoOnly")}</p>
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  {t("ssoUnavailable")}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
