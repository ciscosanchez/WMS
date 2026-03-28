"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { syncInventoryToShopify } from "@/modules/orders/shopify-sync";

interface Props {
  clientId: string;
}

function formatShopifyInventorySyncError(error: string) {
  if (error.includes("read_locations")) {
    return "Shopify inventory sync is blocked because this app still needs merchant approval for the Locations permission. Approve the app scope in Shopify, then try again.";
  }

  if (error.includes("Shopify not configured")) {
    return "Shopify is not configured for this tenant yet.";
  }

  if (error.includes("403")) {
    return "Shopify rejected the inventory sync request. Check app permissions and store approval settings.";
  }

  return error;
}

export function ShopifyInventorySyncButton({ clientId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncInventoryToShopify(clientId);
      if ("error" in result) {
        toast.error(
          formatShopifyInventorySyncError(result.error ?? "Failed to sync inventory to Shopify.")
        );
      } else {
        toast.success(`Synced ${result.synced} SKU${result.synced !== 1 ? "s" : ""} to Shopify`);
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={isPending}>
      <BarChart2 className={`mr-2 h-4 w-4 ${isPending ? "animate-pulse" : ""}`} />
      {isPending ? "Syncing..." : "Sync Inventory"}
    </Button>
  );
}
