"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncShopifyOrders } from "@/modules/orders/shopify-sync";

interface Props {
  clientId: string;
}

export function ShopifySyncButton({ clientId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<{ imported: number; skipped: number } | null>(null);

  function handleSync() {
    startTransition(async () => {
      const result = await syncShopifyOrders(clientId);
      if (result.error) {
        toast.error(`Shopify sync failed: ${result.error}`);
      } else {
        setLastResult({ imported: result.imported, skipped: result.skipped });
        if (result.imported > 0) {
          toast.success(
            `Imported ${result.imported} new order${result.imported !== 1 ? "s" : ""} from Shopify`
          );
        } else {
          toast.info(`No new orders — ${result.skipped} already imported`);
        }
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={isPending}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending
        ? "Syncing..."
        : lastResult
          ? `Sync Shopify (${lastResult.imported} imported)`
          : "Sync Shopify"}
    </Button>
  );
}
