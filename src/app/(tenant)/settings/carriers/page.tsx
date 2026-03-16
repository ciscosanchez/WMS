"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Settings2, Truck, Wifi } from "lucide-react";

// ---------- types ----------

interface CarrierCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
}

interface CarrierAccount {
  id: string;
  name: string;
  carrier: "ups" | "fedex" | "usps";
  connected: boolean;
  accountNumber?: string;
  fields: CarrierCredentialField[];
  credentials: Record<string, string>;
}

// ---------- seed data ----------

const carriersSeed: CarrierAccount[] = [
  {
    id: "ups",
    name: "UPS",
    carrier: "ups",
    connected: true,
    accountNumber: "A1B21234",
    fields: [
      { key: "accountNumber", label: "Account Number", type: "text", placeholder: "e.g. A1B2C3" },
      { key: "accessKey", label: "Access Key", type: "password", placeholder: "UPS access key" },
      { key: "userId", label: "User ID", type: "text", placeholder: "UPS user ID" },
      { key: "password", label: "Password", type: "password", placeholder: "UPS password" },
    ],
    credentials: {
      accountNumber: "A1B21234",
      accessKey: "••••••••",
      userId: "wms_user",
      password: "••••••••",
    },
  },
  {
    id: "fedex",
    name: "FedEx",
    carrier: "fedex",
    connected: true,
    accountNumber: "4567891234",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "FedEx API client ID" },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "FedEx API client secret",
      },
      {
        key: "accountNumber",
        label: "Account Number",
        type: "text",
        placeholder: "e.g. 456789123",
      },
    ],
    credentials: {
      clientId: "l7xx••••••••",
      clientSecret: "••••••••",
      accountNumber: "4567891234",
    },
  },
  {
    id: "usps",
    name: "USPS",
    carrier: "usps",
    connected: false,
    fields: [
      {
        key: "userId",
        label: "Web Tools User ID",
        type: "text",
        placeholder: "USPS Web Tools user ID",
      },
    ],
    credentials: {},
  },
];

// ---------- helpers ----------

function maskAccountNumber(account?: string): string {
  if (!account || account.length < 4) return "N/A";
  return `****${account.slice(-4)}`;
}

// ---------- component ----------

export default function CarrierAccountsPage() {
  const [carriers, setCarriers] = useState<CarrierAccount[]>(carriersSeed);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCarrier, setActiveCarrier] = useState<CarrierAccount | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null);

  // ---------- handlers ----------

  function openConfigureDialog(carrier: CarrierAccount) {
    setActiveCarrier(carrier);
    setFormValues({ ...carrier.credentials });
    setDialogOpen(true);
  }

  function handleFieldChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveCredentials() {
    if (!activeCarrier) return;
    setSaving(true);

    // Simulate API call
    setTimeout(() => {
      const hasValues = Object.values(formValues).some((v) => v.trim().length > 0);

      setCarriers((prev) =>
        prev.map((c) =>
          c.id === activeCarrier.id
            ? {
                ...c,
                connected: hasValues,
                credentials: { ...formValues },
                accountNumber: formValues.accountNumber || formValues.userId || c.accountNumber,
              }
            : c,
        ),
      );

      setSaving(false);
      setDialogOpen(false);
      toast.success(`${activeCarrier.name} credentials saved`);
    }, 600);
  }

  function handleTestConnection(carrierId: string) {
    setTestingId(carrierId);

    // Simulate connection test
    setTimeout(() => {
      const carrier = carriers.find((c) => c.id === carrierId);
      setTestingId(null);

      if (carrier?.connected) {
        toast.success(`${carrier.name} connection successful`);
      } else {
        toast.error(`${carrier?.name ?? "Carrier"} is not configured`);
      }
    }, 1500);
  }

  // ---------- render ----------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carrier Accounts"
        description="Manage shipping carrier integrations for rate shopping and label generation"
      >
        <Button asChild variant="outline">
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {carriers.map((carrier) => (
          <Card key={carrier.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{carrier.name}</CardTitle>
              </div>
              <Badge
                variant={carrier.connected ? "default" : "secondary"}
                className={
                  carrier.connected
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : ""
                }
              >
                {carrier.connected ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  "Not Configured"
                )}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Account Number</p>
                <p className="font-mono font-medium">
                  {carrier.connected ? maskAccountNumber(carrier.accountNumber) : "--"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openConfigureDialog(carrier)}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!carrier.connected || testingId === carrier.id}
                  onClick={() => handleTestConnection(carrier.id)}
                >
                  {testingId === carrier.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configure Carrier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {activeCarrier?.name}</DialogTitle>
            <DialogDescription>
              Enter your {activeCarrier?.name} API credentials. These are stored encrypted and used
              for rate shopping, label generation, and tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {activeCarrier?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formValues[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label>Environment</Label>
              <select
                value={formValues.useSandbox ?? "true"}
                onChange={(e) => handleFieldChange("useSandbox", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="true">Sandbox / Testing</option>
                <option value="false">Production</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCredentials} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Credentials"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
