"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, XCircle, FileText, Loader2, Pencil, Save } from "lucide-react";
import { saveReview, createShipmentFromExtraction } from "@/modules/receiving/docai-actions";
import type { ShipmentData, ExtractedField } from "@/lib/integrations/docai";

interface ExtractionReviewProps {
  job: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
    documentType: string | null;
    status: string;
    confidence: number | null;
    extractedData: unknown;
    reviewedData: unknown;
  };
  fileViewUrl?: string;
  clientId?: string;
  clients?: Array<{ id: string; name: string }>;
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9) {
    return (
      <Badge className="bg-green-100 text-green-700 gap-1">
        <CheckCircle className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  if (confidence >= 0.7) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 gap-1">
        <AlertTriangle className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 gap-1">
      <XCircle className="h-3 w-3" />
      {Math.round(confidence * 100)}%
    </Badge>
  );
}

function fieldRow(
  label: string,
  field: ExtractedField<unknown> | undefined,
  editValue: string,
  onEdit: (val: string) => void,
  editing: boolean
) {
  if (!field) return null;
  const displayVal =
    field.value === null || field.value === undefined
      ? ""
      : Array.isArray(field.value)
        ? field.value.join(", ")
        : String(field.value);

  return (
    <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 py-2 border-b last:border-0">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {editing ? (
        <Input value={editValue} onChange={(e) => onEdit(e.target.value)} className="h-8" />
      ) : (
        <span className={`text-sm ${field.confidence < 0.7 ? "text-red-600 font-medium" : ""}`}>
          {displayVal || "-"}
        </span>
      )}
      {confidenceBadge(field.confidence)}
    </div>
  );
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bol: "Bill of Lading",
  packing_list: "Packing List",
  commercial_invoice: "Commercial Invoice",
  purchase_order: "Purchase Order",
  warehouse_receipt: "Warehouse Receipt",
  receiving_report: "Receiving Report",
  shipping_label: "Shipping Label",
};

export function ExtractionReview({ job, fileViewUrl, clientId, clients }: ExtractionReviewProps) {
  const router = useRouter();
  const data = (job.reviewedData ?? job.extractedData) as ShipmentData | null;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clientId || "");

  // Editable field values — initialize from extracted data
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    if (!data) return {} as Record<string, string>;
    return {
      shipper: data.shipper?.value || "",
      carrier: data.carrier?.value || "",
      consignee: data.consignee?.value || "",
      supplier: data.supplier?.value || "",
      trackingNumber: data.trackingNumber?.value || "",
      proNumber: data.proNumber?.value || "",
      poNumbers: data.poNumbers?.value?.join(", ") || "",
      invoiceNumber: data.invoiceNumber?.value || "",
      customerReference: data.customerReference?.value || "",
      totalPieces: String(data.totalPieces?.value ?? ""),
      totalWeightLb: String(data.totalWeightLb?.value ?? ""),
      notes: data.notes?.value || "",
    };
  });

  function updateEdit(key: string) {
    return (val: string) => setEdits((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSaveReview() {
    setSaving(true);
    try {
      // Build reviewed data preserving confidence scores but updating values
      const reviewed = structuredClone(data) as unknown as Record<string, unknown>;
      for (const [key, val] of Object.entries(edits)) {
        const field = reviewed[key] as ExtractedField<unknown> | undefined;
        if (field) {
          if (key === "poNumbers") {
            field.value = val
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          } else if (key === "totalPieces" || key === "totalWeightLb") {
            field.value = val ? Number(val) : null;
          } else {
            field.value = val || null;
          }
        }
      }
      await saveReview(job.id, reviewed as Record<string, unknown>);
      setEditing(false);
      toast.success("Review saved");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateShipment() {
    if (!selectedClientId) {
      toast.error("Select a client first");
      return;
    }
    setCreating(true);
    try {
      const shipment = await createShipmentFromExtraction(job.id, selectedClientId);
      toast.success(`Shipment ${shipment.shipmentNumber} created`);
      router.push(`/receiving/${shipment.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create shipment");
    } finally {
      setCreating(false);
    }
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No extraction data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Document viewer */}
      <Card className="lg:row-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {job.fileName}
            </CardTitle>
            <Badge variant="outline">
              {DOC_TYPE_LABELS[job.documentType || ""] || job.documentType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {fileViewUrl ? (
            job.mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileViewUrl} alt={job.fileName} className="w-full rounded-md border" />
            ) : (
              <iframe
                src={fileViewUrl}
                className="w-full h-[700px] rounded-md border"
                title={job.fileName}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-[400px] rounded-md border bg-muted text-muted-foreground">
              Document preview not available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right top: Extracted fields */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Extracted Data</CardTitle>
            <div className="flex items-center gap-2">
              {job.confidence !== null && confidenceBadge(job.confidence)}
              {job.status === "review" && !editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {editing && (
                <Button size="sm" onClick={handleSaveReview} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-0">
              {fieldRow("Shipper", data.shipper, edits.shipper, updateEdit("shipper"), editing)}
              {fieldRow("Carrier", data.carrier, edits.carrier, updateEdit("carrier"), editing)}
              {fieldRow(
                "Consignee",
                data.consignee,
                edits.consignee,
                updateEdit("consignee"),
                editing
              )}
              {fieldRow("Supplier", data.supplier, edits.supplier, updateEdit("supplier"), editing)}
              {fieldRow(
                "Tracking #",
                data.trackingNumber,
                edits.trackingNumber,
                updateEdit("trackingNumber"),
                editing
              )}
              {fieldRow("PRO #", data.proNumber, edits.proNumber, updateEdit("proNumber"), editing)}
              {fieldRow("PO #s", data.poNumbers, edits.poNumbers, updateEdit("poNumbers"), editing)}
              {fieldRow(
                "Invoice #",
                data.invoiceNumber,
                edits.invoiceNumber,
                updateEdit("invoiceNumber"),
                editing
              )}
              {fieldRow(
                "Customer Ref",
                data.customerReference,
                edits.customerReference,
                updateEdit("customerReference"),
                editing
              )}
              {fieldRow(
                "Total Pieces",
                data.totalPieces,
                edits.totalPieces,
                updateEdit("totalPieces"),
                editing
              )}
              {fieldRow(
                "Weight (lb)",
                data.totalWeightLb,
                edits.totalWeightLb,
                updateEdit("totalWeightLb"),
                editing
              )}
              {editing ? (
                <div className="py-2">
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  <Textarea
                    value={edits.notes}
                    onChange={(e) => updateEdit("notes")(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              ) : (
                fieldRow("Notes", data.notes, edits.notes, updateEdit("notes"), false)
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right bottom: Actions + Line items */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Create Shipment — always visible at top */}
          {(job.status === "review" || job.status === "completed") && (
            <div className="space-y-3 pb-4 border-b">
              {clients && clients.length > 0 && (
                <div>
                  <Label className="text-sm">Whose freight is this? (Client)</Label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                onClick={handleCreateShipment}
                disabled={creating || !selectedClientId}
                className="w-full"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Create Inbound Shipment
              </Button>
            </div>
          )}

          {/* Line items */}
          <div>
            <p className="text-sm font-medium mb-2">Line Items ({data.lineItems?.value?.length || 0})</p>
            {data.lineItems?.value && data.lineItems.value.length > 0 ? (
              <ScrollArea className="max-h-[250px]">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Pcs</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>PO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.lineItems.value.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.pieces}</TableCell>
                          <TableCell>{item.packageType || "-"}</TableCell>
                          <TableCell>{item.poNumber || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No line items extracted</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
