"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  Camera,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Check,
} from "lucide-react";
import { processDocument, updateShipmentFromExtraction } from "@/modules/receiving/docai-actions";
import type { ShipmentData } from "@/lib/integrations/docai";

type Stage = "idle" | "uploading" | "processing" | "review" | "done";

interface DocScanModalProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  shipmentNumber: string;
  clientName?: string;
}

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.9)
    return (
      <Badge className="bg-green-100 text-green-700 text-xs gap-1 shrink-0">
        <CheckCircle className="h-3 w-3" />
        {Math.round(value * 100)}%
      </Badge>
    );
  if (value >= 0.7)
    return (
      <Badge className="bg-yellow-100 text-yellow-700 text-xs gap-1 shrink-0">
        <AlertTriangle className="h-3 w-3" />
        {Math.round(value * 100)}%
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-700 text-xs gap-1 shrink-0">
      <XCircle className="h-3 w-3" />
      {Math.round(value * 100)}%
    </Badge>
  );
}

function ExtractedField({ label, field }: { label: string; field?: { value: unknown; confidence: number } }) {
  if (!field) return null;
  const val = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "");
  if (!val) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className={`text-sm font-medium flex-1 ${field.confidence < 0.7 ? "text-red-600" : ""}`}>
        {val}
      </span>
      <ConfidenceBadge value={field.confidence} />
    </div>
  );
}

export function DocScanModal({ open, onClose, shipmentId, shipmentNumber, clientName }: DocScanModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  function handleClose() {
    if (stage === "processing") return; // Don't close while AI is working
    setStage("idle");
    setJob(null);
    onClose();
  }

  async function handleFile(file: File) {
    setStage("uploading");
    try {
      // Upload to S3
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          entityType: "shipment",
          entityId: shipmentId,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const { uploadUrl, key } = await res.json();

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setStage("processing");

      const result = await processDocument({
        fileKey: key,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        sourceType: "upload",
        shipmentId,
        clientName,
      });

      if ("error" in result) {
        toast.error(result.error as string);
        setStage("idle");
      } else {
        setJob(result);
        setStage("review");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Processing failed");
      setStage("idle");
    }
  }

  async function handleApplyToShipment() {
    if (!job) return;
    setApplying(true);
    try {
      await updateShipmentFromExtraction(shipmentId, job.id);
      setStage("done");
      toast.success("Shipment fields updated from document");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update shipment");
    } finally {
      setApplying(false);
    }
  }

  const extracted = job ? ((job.reviewedData ?? job.extractedData) as ShipmentData | null) : null;
  const docTypeLabels: Record<string, string> = {
    bol: "Bill of Lading",
    packing_list: "Packing List",
    commercial_invoice: "Commercial Invoice",
    shipping_label: "Shipping Label",
    warehouse_receipt: "Warehouse Receipt",
    receiving_report: "Receiving Report",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Scan Document — {shipmentNumber}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Idle: Upload prompt ─── */}
        {stage === "idle" && (
          <div className="flex flex-col items-center py-8 gap-5">
            <div className="rounded-full bg-purple-100 p-4">
              <Sparkles className="h-7 w-7 text-purple-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Upload a shipping document</p>
              <p className="text-sm text-muted-foreground">
                BOL, packing list, or label — AI will extract carrier, tracking, PO, and line items
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.capture = "environment";
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) handleFile(f);
                  };
                  input.click();
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG — max 20MB</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* ─── Uploading ─── */}
        {stage === "uploading" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading document...</p>
          </div>
        )}

        {/* ─── Processing ─── */}
        {stage === "processing" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-purple-600 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Claude is reading the document...</p>
              <p className="text-sm text-muted-foreground">
                Extracting carrier, BOL, tracking number, and line items
              </p>
            </div>
          </div>
        )}

        {/* ─── Review: Extracted fields ─── */}
        {stage === "review" && extracted && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {job.documentType && (
                  <Badge variant="outline" className="text-xs">
                    {docTypeLabels[job.documentType] ?? job.documentType}
                  </Badge>
                )}
                {job.confidence != null && <ConfidenceBadge value={job.confidence} />}
              </div>
              <span className="text-xs text-muted-foreground">
                {extracted.lineItems?.value?.length ?? 0} line items extracted
              </span>
            </div>

            <div className="rounded-md border px-4 py-1">
              <ExtractedField label="Carrier"    field={extracted.carrier} />
              <ExtractedField label="BOL / PRO #" field={extracted.proNumber} />
              <ExtractedField label="Tracking #" field={extracted.trackingNumber} />
              <ExtractedField label="PO #"       field={extracted.poNumbers} />
              <ExtractedField label="Shipper"    field={extracted.shipper} />
              <ExtractedField label="Total Pcs"  field={extracted.totalPieces} />
              <ExtractedField label="Weight (lb)" field={extracted.totalWeightLb} />
            </div>

            <p className="text-xs text-muted-foreground">
              Clicking &ldquo;Update Shipment&rdquo; will overwrite the carrier, BOL, and tracking fields above.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Dismiss
              </Button>
              <Button onClick={handleApplyToShipment} disabled={applying}>
                {applying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Update Shipment
              </Button>
            </div>
          </div>
        )}

        {/* ─── Done ─── */}
        {stage === "done" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Shipment updated</p>
              <p className="text-sm text-muted-foreground">
                Carrier, BOL, and tracking number populated from the document
              </p>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
