"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/shared/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  File,
  Download,
  Eye,
  Image,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { processDocument } from "@/modules/receiving/docai-actions";

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  uploadedAt: string;
}

interface ProcessingJob {
  id: string;
  fileName: string;
  status: string;
  documentType: string | null;
  confidence: number | null;
}

const typeLabels: Record<string, string> = {
  bol: "BOL",
  packing_list: "Packing List",
  photo: "Photo",
  inspection_report: "Inspection",
  commercial_invoice: "Invoice",
  shipping_label: "Label",
  warehouse_receipt: "Receipt",
  receiving_report: "Receiving Rpt",
};

const typeIcons: Record<string, typeof File> = {
  bol: FileText,
  packing_list: FileText,
  photo: Image,
  inspection_report: FileText,
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string, confidence: number | null) {
  switch (status) {
    case "processing":
      return (
        <Badge className="bg-blue-100 text-blue-700 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "review":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Review {confidence ? `${Math.round(confidence * 100)}%` : ""}
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 gap-1">
          <CheckCircle className="h-3 w-3" />
          Done
        </Badge>
      );
    case "failed":
      return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
    default:
      return null;
  }
}

interface DocumentPanelProps {
  shipmentId: string;
  documents?: Document[];
  processingJobs?: ProcessingJob[];
  clientName?: string;
}

export function DocumentPanel({
  shipmentId,
  documents = [],
  processingJobs = [],
  clientName,
}: DocumentPanelProps) {
  const router = useRouter();
  const [_extracting, setExtracting] = useState<string | null>(null);

  async function handleExtract(doc: { key: string; fileName: string; fileUrl: string }) {
    setExtracting(doc.key);
    try {
      const mimeType = doc.fileName.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : doc.fileName.toLowerCase().match(/\.(jpg|jpeg)$/)
          ? "image/jpeg"
          : doc.fileName.toLowerCase().endsWith(".png")
            ? "image/png"
            : "application/pdf";

      await processDocument({
        fileKey: doc.key,
        fileName: doc.fileName,
        mimeType,
        sourceType: "upload",
        shipmentId,
        clientName,
      });

      toast.success("Extraction complete — ready for review");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(null);
    }
  }

  return (
    <div className="space-y-4">
      <FileUpload
        entityType="shipment"
        entityId={shipmentId}
        label="Upload Document"
        onUploadComplete={handleExtract}
      />

      {/* Processing jobs */}
      {processingJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            AI Extractions
          </p>
          {processingJobs.map((job) => (
            <div key={job.id} className="flex items-center gap-3 rounded-md border p-3">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{job.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {job.documentType && (
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[job.documentType] || job.documentType}
                    </Badge>
                  )}
                  {statusBadge(job.status, job.confidence)}
                </div>
              </div>
              {job.status === "review" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/receiving/review/${job.id}`)}
                >
                  Review
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Documents
          </p>
          {documents.map((doc) => {
            const Icon = typeIcons[doc.type] || File;
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-md border p-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[doc.type] || doc.type}
                    </Badge>
                    {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {documents.length === 0 && processingJobs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Upload a document to get started — AI will extract shipment data automatically
        </p>
      )}
    </div>
  );
}
