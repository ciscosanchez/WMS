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
import {
  saveCarrierCredentials,
  testCarrierConnection,
  type CarrierCredentials,
} from "@/modules/settings/actions";

interface CarrierDef {
  id: string;
  name: string;
  fields: { key: string; label: string; type: "text" | "password"; placeholder: string }[];
}

const CARRIERS: CarrierDef[] = [
  {
    id: "ups",
    name: "UPS",
    fields: [
      { key: "accountNumber", label: "Account Number", type: "text", placeholder: "e.g. A1B2C3" },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "UPS client ID" },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "UPS client secret",
      },
    ],
  },
  {
    id: "fedex",
    name: "FedEx",
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
  },
  {
    id: "usps",
    name: "USPS",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "USPS client ID" },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "USPS client secret",
      },
    ],
  },
];

function isConnected(creds: CarrierCredentials): boolean {
  return !!(creds.clientId || creds.accountNumber);
}

function maskValue(val?: string): string {
  if (!val || val.length < 4) return "N/A";
  return `****${val.slice(-4)}`;
}

interface Props {
  initialCreds: Record<string, CarrierCredentials>;
}

export function CarriersClient({ initialCreds }: Props) {
  const [creds, setCreds] = useState(initialCreds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCarrier, setActiveCarrier] = useState<CarrierDef | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  function openConfigure(carrier: CarrierDef) {
    setActiveCarrier(carrier);
    const existing = creds[carrier.id] ?? {};
    setFormValues(
      Object.fromEntries(
        carrier.fields.map((f) => [f.key, (existing as Record<string, string>)[f.key] ?? ""])
      )
    );
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!activeCarrier) return;
    setSaving(true);
    try {
      const result = await saveCarrierCredentials(activeCarrier.id, formValues);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCreds((prev) => ({ ...prev, [activeCarrier.id]: formValues }));
        setDialogOpen(false);
        toast.success(`${activeCarrier.name} credentials saved`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(carrierId: string) {
    setTestingId(carrierId);
    try {
      const result = await testCarrierConnection(carrierId);
      if (result.success) {
        toast.success(`${carrierId.toUpperCase()} connection verified`);
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTestingId(null);
    }
  }

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
        {CARRIERS.map((carrier) => {
          const c = creds[carrier.id] ?? {};
          const connected = isConnected(c);
          return (
            <Card key={carrier.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">{carrier.name}</CardTitle>
                </div>
                <Badge
                  variant={connected ? "default" : "secondary"}
                  className={
                    connected
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : ""
                  }
                >
                  {connected ? (
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
                  <p className="text-muted-foreground">Account</p>
                  <p className="font-mono font-medium">
                    {connected ? maskValue(c.accountNumber || c.clientId) : "--"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openConfigure(carrier)}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!connected || testingId === carrier.id}
                    onClick={() => handleTest(carrier.id)}
                  >
                    {testingId === carrier.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-4 w-4" />
                        Test
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {activeCarrier?.name}</DialogTitle>
            <DialogDescription>Enter your {activeCarrier?.name} API credentials.</DialogDescription>
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
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
