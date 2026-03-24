"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, DollarSign, Users, Save, Plug } from "lucide-react";
import { saveTenantSettings } from "@/modules/settings/actions";

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
}

export function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
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
  const [saving, setSaving] = useState(false);

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
