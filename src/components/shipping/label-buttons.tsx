"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateShipmentLabel, getLabelDownloadUrl } from "@/modules/shipping/actions";

// ── Generate Label ────────────────────────────────────────────────────────────

/**
 * Calls the carrier API, stores the PDF in MinIO, then opens it in a new tab.
 * Shown when a carrier is selected but no label has been generated yet.
 */
export function GenerateLabelButton({ shipmentId }: { shipmentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateShipmentLabel(shipmentId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Label created — tracking: ${result.trackingNumber}`);
      // Open PDF in new tab immediately
      if (result.labelKey) {
        window.open(result.labelKey, "_blank", "noopener");
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={handleGenerate} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Printer className="mr-2 h-4 w-4" />
      )}
      {isPending ? "Generating…" : "Generate Label"}
    </Button>
  );
}

// ── Reprint Label ─────────────────────────────────────────────────────────────

/**
 * Fetches a fresh presigned URL for the stored label PDF and opens it.
 * Shown when a label already exists on the shipment.
 */
export function ReprintLabelButton({ shipmentId }: { shipmentId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleReprint() {
    startTransition(async () => {
      const result = await getLabelDownloadUrl(shipmentId);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not retrieve label");
        return;
      }
      window.open(result.url, "_blank", "noopener");
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReprint} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {isPending ? "Opening…" : "Reprint Label"}
    </Button>
  );
}
