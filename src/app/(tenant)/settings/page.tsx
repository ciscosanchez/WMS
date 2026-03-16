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
import { Building2, DollarSign, Users, Save } from "lucide-react";

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("Armstrong Warehouse");
  const [timezone, setTimezone] = useState("America/New_York");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [freightMode, setFreightMode] = useState(true);
  const [dtcMode, setDtcMode] = useState(true);
  const [asnPrefix, setAsnPrefix] = useState("ASN-");
  const [orderPrefix, setOrderPrefix] = useState("ORD-");
  const [adjustmentPrefix, setAdjustmentPrefix] = useState("ADJ-");
  const [pickPrefix, setPickPrefix] = useState("PCK-");
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
      toast.success("Settings saved successfully");
    }, 500);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your warehouse configuration">
        <Button asChild variant="outline">
          <Link href="/settings/integrations">
            <DollarSign className="mr-2 h-4 w-4" />
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
        {/* General */}
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
          </CardContent>
        </Card>

        {/* Operational Modes */}
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

        {/* Sequence Prefixes */}
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
