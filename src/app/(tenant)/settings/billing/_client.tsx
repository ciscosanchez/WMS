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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, Settings2, FileText, Loader2 } from "lucide-react";
import {
  saveDefaultRateCard,
  saveClientRateCard,
  generateInvoice,
  getInvoices,
} from "@/modules/billing/actions";
import { format } from "date-fns";
import type {
  BillingConfigProps as Props,
  ClientRow,
  InvoiceRow,
  RateLine,
} from "./billing-config-data";
import { buildRateLines } from "./billing-config-data";

// ─── Component ───────────────────────────────────────────

export default function BillingConfigClient({
  defaultRateCard,
  clients,
  invoices: initialInvoices,
}: Props) {
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

  // Invoice generation state
  const [invoiceClientId, setInvoiceClientId] = useState<string>("");
  const [invoiceMonth, setInvoiceMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // "YYYY-MM"
  );
  const [pendingInvoice, startInvoice] = useTransition();
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);

  // ─── Default rates ───────────────────────────────────

  function handleDefaultAmountChange(serviceType: string, value: string) {
    setDefaultRates((prev) =>
      prev.map((r) =>
        r.serviceType === serviceType ? { ...r, unitRate: parseFloat(value) || 0 } : r
      )
    );
  }

  function handleSaveDefaults() {
    startDefault(async () => {
      await saveDefaultRateCard(
        defaultRates.map((r) => ({
          serviceType: r.serviceType,
          unitRate: r.unitRate,
          uom: r.basisCode,
        })),
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
    setClientMinimum(
      client.rateCard?.monthlyMinimum ? Number(client.rateCard.monthlyMinimum) : defaultMinimum
    );
    setDialogOpen(true);
  }

  function handleClientRateChange(serviceType: string, value: string) {
    setClientRates((prev) =>
      prev.map((r) =>
        r.serviceType === serviceType ? { ...r, unitRate: parseFloat(value) || 0 } : r
      )
    );
  }

  function handleSaveClientRates() {
    if (!activeClient) return;
    startClient(async () => {
      await saveClientRateCard(
        activeClient.id,
        clientRates.map((r) => ({
          serviceType: r.serviceType,
          unitRate: r.unitRate,
          uom: r.basisCode,
        })),
        clientMinimum
      );
      toast.success(`Rates saved for ${activeClient.name}`);
      setDialogOpen(false);
    });
  }

  // ─── Invoice generation ──────────────────────────────

  function handleGenerateInvoice() {
    if (!invoiceClientId) {
      toast.error("Select a client");
      return;
    }
    const [year, month] = invoiceMonth.split("-").map(Number);
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0, 23, 59, 59); // Last day of month

    startInvoice(async () => {
      try {
        await generateInvoice(invoiceClientId, fromDate, toDate);
        toast.success("Invoice generated");
        // Refresh invoice list
        const fresh = await getInvoices();
        setInvoices(fresh);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
      }
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
                  <TableHead className="w-36">Rate Basis</TableHead>
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
                        onChange={(e) =>
                          handleDefaultAmountChange(rate.serviceType, e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rate.basisLabel}</TableCell>
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
                          $
                          {(hasCustom
                            ? Number(client.rateCard!.monthlyMinimum)
                            : defaultMinimum
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{overrides}</TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Generate Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={invoiceClientId} onValueChange={(v) => setInvoiceClientId(v ?? "")}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Billing Month</Label>
              <Input
                type="month"
                className="w-40"
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
              />
            </div>
            <Button onClick={handleGenerateInvoice} disabled={pendingInvoice || !invoiceClientId}>
              {pendingInvoice ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {pendingInvoice ? "Generating…" : "Generate Invoice"}
            </Button>
          </div>

          {invoices.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.client.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.periodStart), "MMM d")} –{" "}
                        {format(new Date(inv.periodEnd), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "default"
                              : inv.status === "sent"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        $
                        {Number(inv.total).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
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
                  <TableHead className="w-36">Rate Basis</TableHead>
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
                      <TableCell className="text-muted-foreground">{rate.basisLabel}</TableCell>
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
