"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TenantAuthMode, TenantSsoProviderConfig } from "@/lib/auth/tenant-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  DollarSign,
  KeyRound,
  ListFilter,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
  Plug,
  MonitorCog,
  Moon,
  Sun,
} from "lucide-react";
import { saveTenantSettings } from "@/modules/settings/actions";
import { useTheme } from "next-themes";

interface Settings {
  companyName: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  freightMode: boolean;
  dtcMode: boolean;
  asnPrefix: string;
  orderPrefix: string;
  adjustmentPrefix: string;
  pickPrefix: string;
  authMode: TenantAuthMode;
  ssoProviders: TenantSsoProviderConfig[];
}

export function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
  const { theme, setTheme } = useTheme();
  const [companyName, setCompanyName] = useState(initialSettings.companyName);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [dateFormat, setDateFormat] = useState(initialSettings.dateFormat);
  const [locale, setLocale] = useState(initialSettings.locale);
  const [freightMode, setFreightMode] = useState(initialSettings.freightMode);
  const [dtcMode, setDtcMode] = useState(initialSettings.dtcMode);
  const [asnPrefix, setAsnPrefix] = useState(initialSettings.asnPrefix);
  const [orderPrefix, setOrderPrefix] = useState(initialSettings.orderPrefix);
  const [adjustmentPrefix, setAdjustmentPrefix] = useState(initialSettings.adjustmentPrefix);
  const [pickPrefix, setPickPrefix] = useState(initialSettings.pickPrefix);
  const [authMode, setAuthMode] = useState<TenantAuthMode>(initialSettings.authMode);
  const [ssoProviders, setSsoProviders] = useState<TenantSsoProviderConfig[]>(
    initialSettings.ssoProviders
  );
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function addSsoProvider() {
    setSsoProviders((current) => [
      ...current,
      {
        id: `sso-${Date.now()}`,
        label: "",
        type: "microsoft",
        startUrl: "",
        enabled: true,
        domains: [],
      },
    ]);
  }

  function updateSsoProvider(index: number, patch: Partial<TenantSsoProviderConfig>) {
    setSsoProviders((current) =>
      current.map((provider, providerIndex) =>
        providerIndex === index ? { ...provider, ...patch } : provider
      )
    );
  }

  function removeSsoProvider(index: number) {
    setSsoProviders((current) => current.filter((_, providerIndex) => providerIndex !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveTenantSettings({
        companyName,
        timezone,
        dateFormat,
        locale,
        freightMode,
        dtcMode,
        asnPrefix,
        orderPrefix,
        adjustmentPrefix,
        pickPrefix,
        authMode,
        ssoProviders,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved successfully");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your warehouse configuration">
        <Button asChild variant="outline">
          <Link href="/settings/integrations">
            <Plug className="mr-2 h-4 w-4" />
            Integrations
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/billing">
            <DollarSign className="mr-2 h-4 w-4" />
            Billing
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/users">
            <Users className="mr-2 h-4 w-4" />
            Manage Users
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/attributes">
            <ListFilter className="mr-2 h-4 w-4" />
            Attributes
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">General</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Language (Tenant Default)</Label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Default language for all users. Individual users can override this from their
                profile menu.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={mounted && theme === "light" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setTheme("light")}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </Button>
                <Button
                  type="button"
                  variant={mounted && theme === "dark" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </Button>
                <Button
                  type="button"
                  variant={mounted && theme === "system" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setTheme("system")}
                >
                  <MonitorCog className="mr-2 h-4 w-4" />
                  System
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Applies to your current browser and device. Tenant defaults stay separate from this
                personal preference.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operational Modes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="freightMode"
                checked={freightMode}
                onCheckedChange={(v) => setFreightMode(!!v)}
              />
              <Label htmlFor="freightMode">Freight / 3PL</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="dtcMode" checked={dtcMode} onCheckedChange={(v) => setDtcMode(!!v)} />
              <Label htmlFor="dtcMode">DTC Fulfillment</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sequence Prefixes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asnPrefix">ASN Prefix</Label>
              <Input
                id="asnPrefix"
                value={asnPrefix}
                onChange={(e) => setAsnPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderPrefix">Order Prefix</Label>
              <Input
                id="orderPrefix"
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustmentPrefix">Adjustment Prefix</Label>
              <Input
                id="adjustmentPrefix"
                value={adjustmentPrefix}
                onChange={(e) => setAdjustmentPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickPrefix">Pick Prefix</Label>
              <Input
                id="pickPrefix"
                value={pickPrefix}
                onChange={(e) => setPickPrefix(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="authMode">Tenant sign-in mode</Label>
              <select
                id="authMode"
                value={authMode}
                onChange={(e) => setAuthMode(e.target.value as TenantAuthMode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="password">Password only</option>
                <option value="hybrid">Password + SSO</option>
                <option value="sso_only">SSO only</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Tenant subdomain login will follow this mode. Base-domain platform admin login stays
                password-based.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">SSO providers</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure Microsoft Entra ID or redirect-based enterprise login options.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSsoProvider}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add provider
                </Button>
              </div>

              {ssoProviders.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No SSO providers configured.
                </div>
              ) : (
                <div className="space-y-4">
                  {ssoProviders.map((provider, index) => (
                    <div key={provider.id} className="rounded-lg border p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {provider.label || `Provider ${index + 1}`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSsoProvider(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`provider-label-${provider.id}`}>Provider label</Label>
                          <Input
                            id={`provider-label-${provider.id}`}
                            value={provider.label}
                            onChange={(e) =>
                              updateSsoProvider(index, {
                                label: e.target.value,
                              })
                            }
                            placeholder="Sign in with Acme SSO"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`provider-type-${provider.id}`}>Provider type</Label>
                          <select
                            id={`provider-type-${provider.id}`}
                            value={provider.type}
                            onChange={(e) =>
                              updateSsoProvider(index, {
                                type: e.target.value as TenantSsoProviderConfig["type"],
                              })
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          >
                            <option value="microsoft">Microsoft Entra ID</option>
                            <option value="oidc">OIDC</option>
                            <option value="saml">SAML</option>
                          </select>
                        </div>
                        {provider.type === "microsoft" ? (
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Provider routing</Label>
                            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              Uses the built-in Microsoft Entra ID flow configured on this
                              deployment. No custom start URL is required for this provider type.
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor={`provider-start-${provider.id}`}>Start URL</Label>
                            <Input
                              id={`provider-start-${provider.id}`}
                              value={provider.startUrl}
                              onChange={(e) =>
                                updateSsoProvider(index, {
                                  startUrl: e.target.value,
                                })
                              }
                              placeholder="https://login.example.com/oidc/start"
                            />
                            <p className="text-xs text-muted-foreground">
                              Use a relative WMS route or an HTTPS provider URL. OIDC and SAML are
                              currently redirect-based provider handoffs, so this should point to
                              your organization&apos;s existing sign-in entrypoint.
                            </p>
                          </div>
                        )}
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor={`provider-domains-${provider.id}`}>
                            Email domains (optional)
                          </Label>
                          <Input
                            id={`provider-domains-${provider.id}`}
                            value={provider.domains.join(", ")}
                            onChange={(e) =>
                              updateSsoProvider(index, {
                                domains: e.target.value
                                  .split(",")
                                  .map((value) => value.trim().toLowerCase())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="acme.com, subsidiary.acme.com"
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <Checkbox
                            id={`provider-enabled-${provider.id}`}
                            checked={provider.enabled}
                            onCheckedChange={(value) =>
                              updateSsoProvider(index, {
                                enabled: !!value,
                              })
                            }
                          />
                          <Label htmlFor={`provider-enabled-${provider.id}`}>Enabled</Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
