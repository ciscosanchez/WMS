"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Plus, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseEDI, parse940, parse856 } from "@/lib/integrations/edi";
import type {
  TradingPartner,
  TradingPartnerStatus,
  EDITransactionType,
} from "@/lib/integrations/edi";

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const initialPartners: TradingPartner[] = [
  {
    id: "1",
    name: "ACME Corp",
    isaQualifier: "ZZ",
    isaId: "ACMECORP",
    supportedTransactions: ["940", "945"],
    status: "active",
    communicationMethod: "sftp",
    endpoint: "sftp://edi.acmecorp.com:22/inbound",
    createdAt: "2025-11-10T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "2",
    name: "Globex Inc",
    isaQualifier: "ZZ",
    isaId: "GLOBEXINC",
    supportedTransactions: ["856", "944"],
    status: "active",
    communicationMethod: "as2",
    endpoint: "https://as2.globex.com/edi",
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
];

const TRANSACTION_LABELS: Record<EDITransactionType, string> = {
  "940": "940 - Shipping Order",
  "945": "945 - Shipping Advice",
  "856": "856 - ASN",
  "944": "944 - Stock Receipt",
};

const STATUS_COLORS: Record<TradingPartnerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  testing: "bg-yellow-100 text-yellow-700",
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function EDIConfigurationPage() {
  const [partners, setPartners] = useState<TradingPartner[]>(initialPartners);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [rawEDI, setRawEDI] = useState("");
  const [parsedResult, setParsedResult] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  // Add Partner form state
  const [newName, setNewName] = useState("");
  const [newIsaId, setNewIsaId] = useState("");
  const [newTransactions, setNewTransactions] = useState<EDITransactionType[]>([]);
  const [newStatus, setNewStatus] = useState<TradingPartnerStatus>("testing");
  const [newMethod, setNewMethod] = useState<TradingPartner["communicationMethod"]>("sftp");
  const [newEndpoint, setNewEndpoint] = useState("");

  function handleToggleTransaction(tx: EDITransactionType) {
    setNewTransactions((prev) =>
      prev.includes(tx) ? prev.filter((t) => t !== tx) : [...prev, tx]
    );
  }

  function handleAddPartner() {
    if (!newName.trim() || !newIsaId.trim()) {
      toast.error("Partner name and ISA ID are required");
      return;
    }
    if (newTransactions.length === 0) {
      toast.error("Select at least one supported transaction");
      return;
    }

    const partner: TradingPartner = {
      id: String(Date.now()),
      name: newName.trim(),
      isaQualifier: "ZZ",
      isaId: newIsaId.trim().toUpperCase(),
      supportedTransactions: newTransactions,
      status: newStatus,
      communicationMethod: newMethod,
      endpoint: newEndpoint.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPartners((prev) => [...prev, partner]);
    toast.success(`Trading partner "${partner.name}" added`);

    // Reset form
    setNewName("");
    setNewIsaId("");
    setNewTransactions([]);
    setNewStatus("testing");
    setNewMethod("sftp");
    setNewEndpoint("");
    setAddDialogOpen(false);
  }

  async function handleParse() {
    if (!rawEDI.trim()) {
      toast.error("Paste EDI content to parse");
      return;
    }

    setParsing(true);
    setParsedResult(null);

    // Small delay to show loading state
    await new Promise((r) => setTimeout(r, 300));

    try {
      const doc = parseEDI(rawEDI.trim());
      const result: Record<string, unknown> = {
        envelope: {
          isa: doc.isa,
          gs: doc.gs,
          ge: doc.ge,
          iea: doc.iea,
          separators: doc.separators,
        },
        transactionSets: doc.transactionSets.map((ts) => {
          const base = {
            type: ts.type,
            segmentCount: ts.segments.length,
          };

          // Attempt specific parsing based on transaction type
          if (ts.type === "940") {
            const parsed = parse940(ts.segments);
            return { ...base, parsed: parsed.data, errors: parsed.errors };
          }
          if (ts.type === "856") {
            const parsed = parse856(ts.segments);
            return { ...base, parsed: parsed.data, errors: parsed.errors };
          }

          return { ...base, segments: ts.segments };
        }),
      };

      setParsedResult(JSON.stringify(result, null, 2));
      toast.success("EDI parsed successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setParsedResult(JSON.stringify({ error: message }, null, 2));
      toast.error("Failed to parse EDI");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EDI Configuration"
        description="Manage trading partners and test EDI document parsing"
      >
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Partner
        </Button>
      </PageHeader>

      {/* Trading Partners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Trading Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner Name</TableHead>
                <TableHead>ISA ID</TableHead>
                <TableHead>Supported Transactions</TableHead>
                <TableHead>Communication</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell className="font-mono text-xs">{partner.isaId}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {partner.supportedTransactions.map((tx) => (
                        <Badge key={tx} variant="secondary" className="text-xs">
                          {tx}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs uppercase">{partner.communicationMethod}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[partner.status]}>{partner.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No trading partners configured. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* EDI Test / Debug Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" />
            EDI Test Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Paste Raw EDI</Label>
            <Textarea
              rows={10}
              className="font-mono text-xs"
              placeholder={
                "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *230101*1200*U*00401*000000001*0*P*:~\nGS*SW*SENDER*RECEIVER*20230101*1200*1*X*004010~\nST*940*0001~\n..."
              }
              value={rawEDI}
              onChange={(e) => setRawEDI(e.target.value)}
            />
          </div>

          <Button onClick={handleParse} disabled={parsing}>
            {parsing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1 h-4 w-4" />
            )}
            Parse
          </Button>

          {parsedResult && (
            <div className="space-y-2">
              <Label>Parsed Result</Label>
              <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-4 text-xs font-mono">
                {parsedResult}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Partner Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Trading Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner Name</Label>
              <Input
                placeholder="e.g. ACME Corp"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>ISA ID</Label>
              <Input
                placeholder="e.g. ACMECORP"
                value={newIsaId}
                onChange={(e) => setNewIsaId(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Supported Transactions</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(TRANSACTION_LABELS) as [EDITransactionType, string][]).map(
                  ([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleToggleTransaction(code)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        newTransactions.includes(code)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TradingPartnerStatus)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="testing">Testing</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Communication Method</Label>
              <select
                value={newMethod}
                onChange={(e) =>
                  setNewMethod(e.target.value as TradingPartner["communicationMethod"])
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="sftp">SFTP</option>
                <option value="as2">AS2</option>
                <option value="api">API</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                placeholder="e.g. sftp://edi.partner.com:22/inbound"
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner}>Add Partner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
