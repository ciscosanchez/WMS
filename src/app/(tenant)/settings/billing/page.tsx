"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Settings2 } from "lucide-react";

// ---------- types ----------

interface RateLine {
  id: string;
  service: string;
  rateType: string;
  amount: number;
  uom: string;
}

interface ClientBilling {
  id: string;
  name: string;
  plan: "default" | "custom";
  monthlyMinimum: number;
  overrideCount: number;
  overrides: RateLine[];
}

// ---------- seed data ----------

const defaultRatesSeed: RateLine[] = [
  {
    id: "rec-pallet",
    service: "Receiving",
    rateType: "Per Pallet",
    amount: 8.5,
    uom: "$",
  },
  {
    id: "rec-carton",
    service: "Receiving",
    rateType: "Per Carton",
    amount: 1.25,
    uom: "$",
  },
  {
    id: "sto-pallet",
    service: "Storage",
    rateType: "Per Pallet / Month",
    amount: 18.0,
    uom: "$",
  },
  {
    id: "sto-sqft",
    service: "Storage",
    rateType: "Per Sq Ft / Month",
    amount: 0.85,
    uom: "$",
  },
  {
    id: "hdl-order",
    service: "Handling",
    rateType: "Per Order",
    amount: 3.5,
    uom: "$",
  },
  {
    id: "hdl-line",
    service: "Handling",
    rateType: "Per Line",
    amount: 0.75,
    uom: "$",
  },
  {
    id: "hdl-unit",
    service: "Handling",
    rateType: "Per Unit",
    amount: 0.15,
    uom: "$",
  },
  {
    id: "shp-markup",
    service: "Shipping",
    rateType: "Markup",
    amount: 10,
    uom: "%",
  },
  {
    id: "va-hour",
    service: "Value-Add",
    rateType: "Per Hour",
    amount: 45.0,
    uom: "$",
  },
];

const clientsSeed: ClientBilling[] = [
  {
    id: "cli-1",
    name: "ACME Corp",
    plan: "custom",
    monthlyMinimum: 2500,
    overrideCount: 3,
    overrides: [
      {
        id: "rec-pallet",
        service: "Receiving",
        rateType: "Per Pallet",
        amount: 7.0,
        uom: "$",
      },
      {
        id: "sto-pallet",
        service: "Storage",
        rateType: "Per Pallet / Month",
        amount: 15.0,
        uom: "$",
      },
      {
        id: "hdl-order",
        service: "Handling",
        rateType: "Per Order",
        amount: 3.0,
        uom: "$",
      },
    ],
  },
  {
    id: "cli-2",
    name: "GLOBEX Inc",
    plan: "default",
    monthlyMinimum: 1000,
    overrideCount: 0,
    overrides: [],
  },
  {
    id: "cli-3",
    name: "INITECH LLC",
    plan: "custom",
    monthlyMinimum: 500,
    overrideCount: 1,
    overrides: [
      {
        id: "va-hour",
        service: "Value-Add",
        rateType: "Per Hour",
        amount: 40.0,
        uom: "$",
      },
    ],
  },
];

// ---------- component ----------

export default function BillingConfigPage() {
  const [defaultRates, setDefaultRates] = useState<RateLine[]>(defaultRatesSeed);
  const [clients, setClients] = useState<ClientBilling[]>(clientsSeed);
  const [savingDefaults, setSavingDefaults] = useState(false);

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<ClientBilling | null>(null);
  const [clientRates, setClientRates] = useState<RateLine[]>([]);
  const [savingClient, setSavingClient] = useState(false);

  // ---------- default rates ----------

  function handleDefaultAmountChange(id: string, value: string) {
    setDefaultRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, amount: parseFloat(value) || 0 } : r)),
    );
  }

  function handleSaveDefaults() {
    setSavingDefaults(true);
    setTimeout(() => {
      setSavingDefaults(false);
      toast.success("Default rates saved successfully");
    }, 500);
  }

  // ---------- client overrides ----------

  function openClientDialog(client: ClientBilling) {
    // Build a full rate card for this client: start with defaults, overlay overrides
    const merged = defaultRates.map((dr) => {
      const override = client.overrides.find((o) => o.id === dr.id);
      return override ? { ...override } : { ...dr };
    });
    setActiveClient(client);
    setClientRates(merged);
    setDialogOpen(true);
  }

  function handleClientRateChange(id: string, value: string) {
    setClientRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, amount: parseFloat(value) || 0 } : r)),
    );
  }

  function handleSaveClientRates() {
    if (!activeClient) return;
    setSavingClient(true);
    setTimeout(() => {
      // Determine which rates differ from defaults
      const overrides = clientRates.filter((cr) => {
        const dr = defaultRates.find((d) => d.id === cr.id);
        return dr && dr.amount !== cr.amount;
      });

      setClients((prev) =>
        prev.map((c) =>
          c.id === activeClient.id
            ? {
                ...c,
                plan: overrides.length > 0 ? "custom" : "default",
                overrideCount: overrides.length,
                overrides,
              }
            : c,
        ),
      );

      setSavingClient(false);
      setDialogOpen(false);
      toast.success(`Rates saved for ${activeClient.name}`);
    }, 500);
  }

  // ---------- render ----------

  return (
    <div className="space-y-6">
      <PageHeader title="Billing Configuration" description="Manage rate cards and client billing">
        <Button asChild variant="outline">
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </PageHeader>

      {/* ---- Default Rate Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Rate Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead className="w-40">Amount</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaultRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.service}</TableCell>
                    <TableCell>{rate.rateType}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 w-32"
                        value={rate.amount}
                        onChange={(e) => handleDefaultAmountChange(rate.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rate.uom}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button onClick={handleSaveDefaults} disabled={savingDefaults}>
            <Save className="mr-2 h-4 w-4" />
            {savingDefaults ? "Saving..." : "Save Default Rates"}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Client Rate Overrides ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Rate Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Monthly Minimum</TableHead>
                  <TableHead className="text-right">Override Count</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <Badge variant={client.plan === "custom" ? "default" : "secondary"}>
                        {client.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ${client.monthlyMinimum.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{client.overrideCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openClientDialog(client)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ---- Client Override Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rate Overrides — {activeClient?.name}</DialogTitle>
            <DialogDescription>
              Adjust rates below. Values that differ from the default card will be saved as
              overrides.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead className="w-40">Amount</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRates.map((rate) => {
                  const defaultRate = defaultRates.find((d) => d.id === rate.id);
                  const isOverridden = defaultRate && defaultRate.amount !== rate.amount;
                  return (
                    <TableRow key={rate.id} className={isOverridden ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{rate.service}</TableCell>
                      <TableCell>{rate.rateType}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-32"
                          value={rate.amount}
                          onChange={(e) => handleClientRateChange(rate.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rate.uom}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClientRates} disabled={savingClient}>
              <Save className="mr-2 h-4 w-4" />
              {savingClient ? "Saving..." : "Save Overrides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
