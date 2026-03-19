"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { syncInventoryToShopify } from "@/modules/orders/shopify-sync";

interface Props {
  clientId: string;
}

export function ShopifyInventorySyncButton({ clientId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncInventoryToShopify(clientId);
      if ("error" in result) {
        toast.error(`Inventory sync failed: ${result.error}`);
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
