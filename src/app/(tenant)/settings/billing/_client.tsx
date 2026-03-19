"use client";

import { useState, useTransition } from "react";
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
import { saveDefaultRateCard, saveClientRateCard } from "@/modules/billing/actions";

// ─── Types ───────────────────────────────────────────────

interface RateLine {
  serviceType: string;
  label: string;
  unitRate: number;
  uom: string;
}

interface ClientRow {
  id: string;
  name: string;
  rateCard: { monthlyMinimum: number; lines: Array<{ serviceType: string; unitRate: number; uom: string }> } | null;
}

interface Props {
  defaultRateCard: { monthlyMinimum: number; lines: Array<{ serviceType: string; unitRate: number; uom: string }> } | null;
  clients: ClientRow[];
}

// ─── Service type display config ─────────────────────────

const SERVICE_CONFIG: Array<{ serviceType: string; label: string; uom: string }> = [
  { serviceType: "receiving_pallet",  label: "Receiving — Per Pallet",       uom: "$" },
  { serviceType: "receiving_carton",  label: "Receiving — Per Carton",       uom: "$" },
  { serviceType: "storage_pallet",    label: "Storage — Per Pallet / Month", uom: "$" },
  { serviceType: "storage_sqft",      label: "Storage — Per Sq Ft / Month",  uom: "$" },
  { serviceType: "handling_order",    label: "Handling — Per Order",         uom: "$" },
  { serviceType: "handling_line",     label: "Handling — Per Line",          uom: "$" },
  { serviceType: "handling_unit",     label: "Handling — Per Unit",          uom: "$" },
  { serviceType: "shipping_markup",   label: "Shipping — Markup",            uom: "%" },
  { serviceType: "value_add_hour",    label: "Value-Add — Per Hour",         uom: "$" },
];

const DEFAULT_RATES: Record<string, number> = {
  receiving_pallet: 8.5,
  receiving_carton: 1.25,
  storage_pallet: 18.0,
  storage_sqft: 0.85,
  handling_order: 3.5,
  handling_line: 0.75,
  handling_unit: 0.15,
  shipping_markup: 10,
  value_add_hour: 45.0,
};

function buildRateLines(
  savedLines: Array<{ serviceType: string; unitRate: number; uom: string }> | undefined
): RateLine[] {
  return SERVICE_CONFIG.map((cfg) => {
    const saved = savedLines?.find((l) => l.serviceType === cfg.serviceType);
    return {
      serviceType: cfg.serviceType,
      label: cfg.label,
      unitRate: saved ? Number(saved.unitRate) : DEFAULT_RATES[cfg.serviceType] ?? 0,
      uom: cfg.uom,
    };
  });
}

// ─── Component ───────────────────────────────────────────

export default function BillingConfigClient({ defaultRateCard, clients }: Props) {
  const [defaultRates, setDefaultRates] = useState<RateLine[]>(
    buildRateLines(defaultRateCard?.lines)
  );
  const [defaultMinimum, setDefaultMinimum] = useState(
    defaultRateCard?.monthlyMinimum ? Number(defaultRateCard.monthlyMinimum) : 0
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<ClientRow | null>(null);
  const [clientRates, setClientRates] = useState<RateLine[]>([]);
  const [clientMinimum, setClientMinimum] = useState(0);

  const [pendingDefault, startDefault] = useTransition();
  const [pendingClient, startClient] = useTransition();

  // ─── Default rates ───────────────────────────────────

  function handleDefaultAmountChange(serviceType: string, value: string) {
    setDefaultRates((prev) =>
      prev.map((r) => (r.serviceType === serviceType ? { ...r, unitRate: parseFloat(value) || 0 } : r))
    );
  }

  function handleSaveDefaults() {
    startDefault(async () => {
      await saveDefaultRateCard(
        defaultRates.map((r) => ({ serviceType: r.serviceType, unitRate: r.unitRate, uom: r.uom })),
        defaultMinimum
      );
      toast.success("Default rates saved");
    });
  }

  // ─── Client overrides ────────────────────────────────

  function openClientDialog(client: ClientRow) {
    const lines = buildRateLines(client.rateCard?.lines ?? defaultRateCard?.lines);
    setActiveClient(client);
    setClientRates(lines);
    setClientMinimum(client.rateCard?.monthlyMinimum ? Number(client.rateCard.monthlyMinimum) : defaultMinimum);
    setDialogOpen(true);
  }

  function handleClientRateChange(serviceType: string, value: string) {
    setClientRates((prev) =>
      prev.map((r) => (r.serviceType === serviceType ? { ...r, unitRate: parseFloat(value) || 0 } : r))
    );
  }

  function handleSaveClientRates() {
    if (!activeClient) return;
    startClient(async () => {
      await saveClientRateCard(
        activeClient.id,
        clientRates.map((r) => ({ serviceType: r.serviceType, unitRate: r.unitRate, uom: r.uom })),
        clientMinimum
      );
      toast.success(`Rates saved for ${activeClient.name}`);
      setDialogOpen(false);
    });
  }

  // ─── Helpers ─────────────────────────────────────────

  function overrideCount(client: ClientRow): number {
    if (!client.rateCard) return 0;
    return client.rateCard.lines.filter((cl) => {
      const dr = defaultRates.find((d) => d.serviceType === cl.serviceType);
      return dr && Number(cl.unitRate) !== dr.unitRate;
    }).length;
  }

  // ─── Render ──────────────────────────────────────────

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

      {/* Default Rate Card */}
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
                  <TableHead className="w-40">Rate</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaultRates.map((rate) => (
                  <TableRow key={rate.serviceType}>
                    <TableCell className="font-medium">{rate.label}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 w-32"
                        value={rate.unitRate}
                        onChange={(e) => handleDefaultAmountChange(rate.serviceType, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rate.uom}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Monthly Minimum ($)</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-8 w-32"
                value={defaultMinimum}
                onChange={(e) => setDefaultMinimum(parseFloat(e.target.value) || 0)}
              />
            </div>
            <Button onClick={handleSaveDefaults} disabled={pendingDefault}>
              <Save className="mr-2 h-4 w-4" />
              {pendingDefault ? "Saving..." : "Save Default Rates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Client Rate Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Rate Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No clients yet. Add clients first.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Monthly Min</TableHead>
                    <TableHead className="text-right">Overrides</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const hasCustom = !!client.rateCard;
                    const overrides = overrideCount(client);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <Badge variant={hasCustom ? "default" : "secondary"}>
                            {hasCustom ? "custom" : "default"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${(hasCustom ? Number(client.rateCard!.monthlyMinimum) : defaultMinimum).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{overrides}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openClientDialog(client)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            Configure
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Override Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rate Overrides — {activeClient?.name}</DialogTitle>
            <DialogDescription>
              Values that differ from the default rate card are highlighted.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-40">Rate</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRates.map((rate) => {
                  const defaultRate = defaultRates.find((d) => d.serviceType === rate.serviceType);
                  const isOverridden = defaultRate && defaultRate.unitRate !== rate.unitRate;
                  return (
                    <TableRow key={rate.serviceType} className={isOverridden ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{rate.label}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-32"
                          value={rate.unitRate}
                          onChange={(e) => handleClientRateChange(rate.serviceType, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rate.uom}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2 text-sm pt-2">
            <span className="text-muted-foreground">Monthly Minimum ($)</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-8 w-32"
              value={clientMinimum}
              onChange={(e) => setClientMinimum(parseFloat(e.target.value) || 0)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClientRates} disabled={pendingClient}>
              <Save className="mr-2 h-4 w-4" />
              {pendingClient ? "Saving..." : "Save Overrides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
