"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ExtractionReview } from "@/components/receiving/extraction-review";
import { processDocument } from "@/modules/receiving/docai-actions";
import { getClients } from "@/modules/clients/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Camera, FileText, Loader2, Sparkles } from "lucide-react";

export default function SmartReceivingPage() {
  const _router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setProcessing(true);

    try {
      // Upload to S3 first
      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          entityType: "docai",
          entityId: "smart-receiving",
        }),
      });

      if (!uploadRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, key } = await uploadRes.json();

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Create a local preview URL
      setPreviewUrl(URL.createObjectURL(file));

      // Send to DocAI for extraction
      const result = await processDocument({
        fileKey: key,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        sourceType: "upload",
      });

      setJob(result);
      toast.success("Extraction complete — review the results below");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Review Extraction">
          <Button
            variant="outline"
            onClick={() => {
              setJob(null);
              setPreviewUrl(undefined);
            }}
          >
            Extract Another
          </Button>
        </PageHeader>
        <ExtractionReview
          job={job}
          fileViewUrl={previewUrl}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Receiving"
        description="Upload a document and AI will extract shipment data automatically"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="rounded-full bg-purple-100 p-4">
              <Sparkles className="h-8 w-8 text-purple-600" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {processing ? "Extracting data..." : "Upload a shipping document"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {processing
                  ? "AI is reading the document and extracting shipment details. This usually takes 10-30 seconds."
                  : "Drop a BOL, packing list, shipping label, or any receiving document. AI will read it and pre-fill a new shipment."}
              </p>
            </div>

            {processing ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <span className="text-sm text-muted-foreground">Processing with Claude Vision...</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button size="lg" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.capture = "environment";
                    input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files);
                    input.click();
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> PDF
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> JPG / PNG
              </span>
              <span>Max 20MB</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
