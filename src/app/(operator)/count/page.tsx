"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCycleCountBins, submitCount } from "@/modules/operator/actions";
import { actionKey } from "@/hooks/use-offline";
import { useSharedOffline } from "@/providers/offline-provider";

type CountBin = Awaited<ReturnType<typeof getCycleCountBins>>[number];

export default function OperatorCountPage() {
  const [bins, setBins] = useState<CountBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBin, setActiveBin] = useState<CountBin | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { executeAction } = useSharedOffline();
  const t = useTranslations("operator.count");
  const tc = useTranslations("common");

  useEffect(() => {
    getCycleCountBins()
      .then((data) => setBins(data as CountBin[]))
      .catch(() => toast.error(t("failedLoadBins")))
      .finally(() => setLoading(false));
  }, [t]);

  function handleBinScan(barcode: string) {
    const bin = bins.find((b) => b.barcode === barcode);
    if (!bin) {
      toast.error(t("binNotFound", { barcode }));
      return;
    }
    setActiveBin(bin);
    // Pre-fill counts with system quantities
    const initial: Record<string, string> = {};
    for (const item of bin.inventory) {
      initial[item.id] = String(item.onHand);
    }
    setCounts(initial);
    toast.success(t("counting", { barcode: bin.barcode }));
  }

  async function handleSubmit() {
    if (!activeBin) return;

    setSubmitting(true);
    try {
      const lines = activeBin.inventory.map((item: CountBin["inventory"][number]) => ({
        productId: item.productId,
        systemQty: item.onHand,
        countedQty: parseInt(counts[item.id] ?? "0"),
        lotNumber: item.lotNumber,
      }));

      const { queued } = await executeAction(
        actionKey("operator", "submitCount"),
        submitCount as (...args: unknown[]) => Promise<unknown>,
        [activeBin.id, lines]
      );

      if (queued) {
        toast.info(t("countQueued"));
      } else {
        const variances = lines.filter(
          (l: { countedQty: number; systemQty: number }) => l.countedQty !== l.systemQty
        );
        if (variances.length > 0) {
          toast.warning(t("countSubmittedVariances", { count: variances.length }));
        } else {
          toast.success(t("countSubmittedClean"));
        }
      }

      setActiveBin(null);
      setCounts({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedSubmitCount"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmpty() {
    if (!activeBin) return;

    setSubmitting(true);
    try {
      const lines = activeBin.inventory.map((item: CountBin["inventory"][number]) => ({
        productId: item.productId,
        systemQty: item.onHand,
        countedQty: 0,
        lotNumber: item.lotNumber,
      }));

      const { queued } = await executeAction(
        actionKey("operator", "submitCount"),
        submitCount as (...args: unknown[]) => Promise<unknown>,
        [activeBin.id, lines]
      );

      if (queued) {
        toast.info(t("emptyCountQueued"));
      } else {
        toast.warning(t("binMarkedEmpty"));
      }

      setActiveBin(null);
      setCounts({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedSubmitCount"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Scan to select bin */}
      <BarcodeScannerInput
        placeholder={t("scanBinPlaceholder")}
        onScan={handleBinScan}
        showFeedback
      />

      {/* Active count */}
      {activeBin && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold font-mono">{activeBin.barcode}</p>
                <p className="text-sm text-muted-foreground">
                  {activeBin.inventory.length} {t("skusInBin")}
                </p>
              </div>
              <Badge className="bg-orange-100 text-orange-700">{t("active")}</Badge>
            </div>

            <div className="space-y-3">
              {activeBin.inventory.map((item: CountBin["inventory"][number]) => {
                const counted = counts[item.id] ?? "";
                const hasVariance = counted !== "" && parseInt(counted) !== item.onHand;
                return (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-mono font-medium">{item.product.sku}</p>
                        <p className="text-xs text-muted-foreground">{item.product.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("system", { onHand: item.onHand })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder={t("countPlaceholder")}
                        className={`h-12 text-center text-xl font-bold ${
                          hasVariance ? "border-orange-400 bg-orange-50" : ""
                        }`}
                        value={counted}
                        onChange={(e) =>
                          setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      {hasVariance && (
                        <span className="text-sm font-medium text-orange-600 whitespace-nowrap">
                          {t("variance", { delta: parseInt(counted) - item.onHand })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button
                className="h-12 flex-1"
                size="lg"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-5 w-5" />
                )}
                {t("submitCount")}
              </Button>
              <Button
                variant="outline"
                className="h-12"
                disabled={submitting}
                onClick={handleEmpty}
              >
                {t("empty")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bin list */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t("binsWithInventory", { count: bins.length })}
        </h2>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingBins")}
          </div>
        )}

        <div className="space-y-2">
          {bins.map((bin) => (
            <Card
              key={bin.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                activeBin?.id === bin.id ? "border-primary" : ""
              }`}
              onClick={() => {
                setActiveBin(bin);
                const initial: Record<string, string> = {};
                for (const item of bin.inventory) {
                  initial[item.id] = String(item.onHand);
                }
                setCounts(initial);
              }}
            >
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-mono font-medium text-sm">{bin.barcode}</p>
                  <p className="text-xs text-muted-foreground">
                    {bin.inventory.length} SKU(s) &middot;{" "}
                    {bin.inventory.reduce(
                      (sum: number, i: CountBin["inventory"][number]) => sum + i.onHand,
                      0
                    )}{" "}
                    {tc("units")}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {bin.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
