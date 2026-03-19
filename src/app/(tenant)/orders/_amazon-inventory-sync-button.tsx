"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncInventoryToAmazon } from "@/modules/orders/shopify-sync";

export function AmazonInventorySyncButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncInventoryToAmazon(clientId);
      if (result.error) {
        toast.error(`Amazon sync failed: ${result.error}`);
      } else {
        toast.success(`Synced ${result.synced} SKU${result.synced !== 1 ? "s" : ""} to Amazon`);
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={isPending}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Syncing..." : "Sync to Amazon"}
    </Button>
  );
}
