"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, Check, Loader2, ScanLine, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { submitCycleCount } from "@/modules/inventory/cycle-count-actions";
import { getPendingCycleCountAdjustments } from "@/modules/inventory/cycle-count-queries";

/* ── Types ──────────────────────────────────────────────────────────────── */

type AdjustmentLine = {
  id: string;
  productId: string;
  product: { sku: string; name: string };
  binId: string;
  bin: { barcode: string };
  systemQty: number;
  countedQty: number;
  variance: number;
};

type Adjustment = {
  id: string;
  adjustmentNumber: string;
  reason: string | null;
  status: string;
  lines: AdjustmentLine[];
};

/* ── Page component ─────────────────────────────────────────────────────── */

export default function OperatorCycleCountPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAdj, setActiveAdj] = useState<Adjustment | null>(null);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [showSystem, setShowSystem] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const countInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("operator.count");
  const tc = useTranslations("common");

  function load() {
    getPendingCycleCountAdjustments()
      .then((data) => setAdjustments(data as Adjustment[]))
      .catch(() => toast.error(t("failedLoadBins")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Barcode scan handler ─────────────────────────────────────────────── */

  function handleBarcodeScan(barcode: string) {
    if (!activeAdj) return;
    const idx = activeAdj.lines.findIndex((l) => l.bin.barcode === barcode);
    if (idx === -1) {
      toast.error(t("binNotFound", { barcode }));
      return;
    }
    setActiveLineIdx(idx);
    toast.success(t("counting", { barcode }));
    setTimeout(() => countInputRef.current?.focus(), 100);
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        handleBarcodeScan(value);
        (e.target as HTMLInputElement).value = "";
      }
    }
  }

  /* ── Submit counts ────────────────────────────────────────────────────── */

  function handleSubmit() {
    if (!activeAdj) return;

    const countEntries = activeAdj.lines
      .filter((line) => counts[line.id] !== undefined && counts[line.id] !== "")
      .map((line) => ({
        lineId: line.id,
        countedQty: parseInt(counts[line.id], 10),
      }));

    if (countEntries.length === 0) {
      toast.error(t("failedSubmitCount"));
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitCycleCount({
          adjustmentId: activeAdj.id,
          counts: countEntries,
        });
        if (result && "error" in result) {
          toast.error(String(result.error));
          return;
        }
        toast.success(t("countSubmittedClean"));
        setActiveAdj(null);
        setCounts({});
        setShowSystem({});
        setActiveLineIdx(0);
        setLoading(true);
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("failedSubmitCount"));
      }
    });
  }

  /* ── Auto-advance on Enter ────────────────────────────────────────────── */

  function handleCountKeyDown(e: React.KeyboardEvent<HTMLInputElement>, lineIdx: number) {
    if (e.key === "Enter" && activeAdj) {
      if (lineIdx < activeAdj.lines.length - 1) {
        setActiveLineIdx(lineIdx + 1);
        setTimeout(() => countInputRef.current?.focus(), 100);
      }
    }
  }

  /* ── Loading state ────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── Active adjustment: counting mode ─────────────────────────────────── */

  if (activeAdj) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{activeAdj.adjustmentNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {activeAdj.lines.length} {tc("lines")} &middot;{" "}
              {Object.keys(counts).filter((k) => counts[k] !== "").length} counted
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActiveAdj(null)}>
            {tc("back")}
          </Button>
        </div>

        {/* Barcode scan input */}
        <div className="relative">
          <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input
            ref={scanInputRef}
            className="h-12 pl-10 text-lg"
            placeholder={t("scanBinPlaceholder")}
            onKeyDown={handleScanKeyDown}
            autoFocus
          />
        </div>

        {/* Line list */}
        <div className="space-y-2">
          {activeAdj.lines.map((line, idx) => {
            const isCurrent = idx === activeLineIdx;
            const counted = counts[line.id] ?? "";
            const hasCount = counted !== "";
            const hasVariance = hasCount && parseInt(counted, 10) !== line.systemQty;

            return (
              <Card
                key={line.id}
                className={`transition-colors ${
                  isCurrent ? "border-primary ring-1 ring-primary" : ""
                } ${hasCount && !isCurrent ? "opacity-70" : ""}`}
                onClick={() => {
                  setActiveLineIdx(idx);
                  setTimeout(() => countInputRef.current?.focus(), 100);
                }}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-semibold text-sm">{line.product.sku}</p>
                      <p className="text-xs text-muted-foreground truncate">{line.bin.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasCount && (
                        <Badge
                          variant={hasVariance ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {hasVariance ? `Var: ${parseInt(counted, 10) - line.systemQty}` : "OK"}
                        </Badge>
                      )}
                      <button
                        className="text-xs text-muted-foreground underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSystem((prev) => ({
                            ...prev,
                            [line.id]: !prev[line.id],
                          }));
                        }}
                      >
                        {showSystem[line.id]
                          ? `Sys: ${line.systemQty}`
                          : t("system", { onHand: "?" })}
                      </button>
                    </div>
                  </div>

                  {isCurrent && (
                    <Input
                      ref={countInputRef}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="h-14 text-center text-2xl font-bold"
                      placeholder={t("countPlaceholder")}
                      value={counted}
                      onChange={(e) =>
                        setCounts((prev) => ({ ...prev, [line.id]: e.target.value }))
                      }
                      onKeyDown={(e) => handleCountKeyDown(e, idx)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button
          className="h-14 w-full text-lg"
          size="lg"
          disabled={isPending || Object.keys(counts).filter((k) => counts[k] !== "").length === 0}
          onClick={handleSubmit}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Check className="mr-2 h-5 w-5" />
          )}
          {t("submitCount")}
        </Button>
      </div>
    );
  }

  /* ── Adjustment list ──────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {adjustments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ListChecks className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No pending counts</h3>
          <p className="mt-1 text-sm text-muted-foreground">All cycle counts are up to date.</p>
        </div>
      )}

      <div className="space-y-2">
        {adjustments.map((adj) => (
          <Card
            key={adj.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => {
              setActiveAdj(adj);
              setActiveLineIdx(0);
              setCounts({});
              setShowSystem({});
            }}
          >
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{adj.adjustmentNumber}</span>
                {adj.reason && (
                  <p className="text-sm text-muted-foreground truncate">{adj.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-medium">{adj.lines.length}</div>
                  <div className="text-xs text-muted-foreground">{tc("lines")}</div>
                </div>
                <Badge variant="default" className="text-xs">
                  {adj.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
