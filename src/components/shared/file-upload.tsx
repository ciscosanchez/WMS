"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  entityType: string;
  entityId: string;
  onUploadComplete?: (file: { key: string; fileName: string; fileUrl: string }) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}

interface UploadedFile {
  key: string;
  fileName: string;
  fileUrl: string;
  size: number;
}

export function FileUpload({
  entityType,
  entityId,
  onUploadComplete,
  accept = "image/*,.pdf,.xlsx,.csv",
  multiple = true,
  label = "Upload Documents",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      try {
        // Get pre-signed URL
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            entityType,
            entityId,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, key, fileUrl } = await res.json();

        // Upload directly to MinIO/S3
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        const uploaded = { key, fileName: file.name, fileUrl, size: file.size };
        setFiles((prev) => [...prev, uploaded]);
        onUploadComplete?.(uploaded);
        toast.success(`Uploaded ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {uploading ? "Uploading..." : label}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Camera capture on mobile
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.capture = "environment";
            input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files);
            input.click();
          }}
          disabled={uploading}
        >
          <Camera className="mr-2 h-4 w-4" />
          Photo
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.key} className="flex items-center gap-3 rounded-md border p-2 text-sm">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{file.fileName}</span>
              <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(file.key)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
