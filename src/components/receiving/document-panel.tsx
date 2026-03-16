"use client";

import { FileUpload } from "@/components/shared/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { File, Download, Eye, Image, FileText } from "lucide-react";

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileSize?: number;
  uploadedAt: string;
}

const mockDocuments: Document[] = [
  { id: "d1", type: "bol", fileName: "BOL-2026-0042.pdf", fileSize: 245000, uploadedAt: "2026-03-12T10:30:00" },
  { id: "d2", type: "packing_list", fileName: "PL-GLX-1234.pdf", fileSize: 128000, uploadedAt: "2026-03-12T10:31:00" },
  { id: "d3", type: "photo", fileName: "dock-arrival-photo.jpg", fileSize: 1850000, uploadedAt: "2026-03-15T09:15:00" },
];

const typeLabels: Record<string, string> = {
  bol: "BOL",
  packing_list: "Packing List",
  photo: "Photo",
  inspection_report: "Inspection",
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

interface DocumentPanelProps {
  shipmentId: string;
  documents?: Document[];
}

export function DocumentPanel({ shipmentId, documents = mockDocuments }: DocumentPanelProps) {
  return (
    <div className="space-y-4">
      <FileUpload entityType="shipment" entityId={shipmentId} label="Upload Document" />

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = typeIcons[doc.type] || File;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
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
    </div>
  );
}
