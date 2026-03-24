"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, SkipForward, XCircle, Route, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import {
  getMyInterleavedRoute,
  buildInterleavedRoute,
  completeInterleavedStep,
  skipInterleavedStep,
  cancelInterleavedRoute,
} from "@/modules/interleaving/actions";

type InterleavedRoute = NonNullable<Awaited<ReturnType<typeof getMyInterleavedRoute>>>;
type InterleavedStep = InterleavedRoute["steps"][number];

const STEP_BADGE: Record<string, { label: string; className: string }> = {
  il_pick: { label: "Pick", className: "bg-blue-100 text-blue-700" },
  il_putaway: { label: "Putaway", className: "bg-green-100 text-green-700" },
  il_replenish: { label: "Replenish", className: "bg-orange-100 text-orange-700" },
};

export default function OperatorInterleavePage() {
  const [route, setRoute] = useState<InterleavedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadRoute() {
    try {
      const r = await getMyInterleavedRoute();
      setRoute(r ?? null);
    } catch {
      toast.error("Failed to load route");
    }
  }

  useEffect(() => {
    loadRoute().finally(() => setLoading(false));
  }, []);

  async function handleBuildRoute() {
    setWorking(true);
    try {
      const result = await buildInterleavedRoute();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Route built");
        await loadRoute();
      }
    } catch {
      toast.error("Failed to build route");
    } finally {
      setWorking(false);
    }
  }

  async function handleComplete(step: InterleavedStep) {
    setWorking(true);
    try {
      const result = await completeInterleavedStep(step.id, step.quantity);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Step completed");
        await loadRoute();
      }
    } catch {
      toast.error("Failed to complete step");
    } finally {
      setWorking(false);
    }
  }

  async function handleSkip(step: InterleavedStep) {
    setWorking(true);
    try {
      const result = await skipInterleavedStep(step.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.info("Step skipped");
        await loadRoute();
      }
    } catch {
      toast.error("Failed to skip step");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    if (!route) return;
    setWorking(true);
    try {
      const result = await cancelInterleavedRoute(route.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.info("Route cancelled");
        setRoute(null);
      }
    } catch {
      toast.error("Failed to cancel route");
    } finally {
      setWorking(false);
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- Route completed (all steps done) ---
  const allDone =
    route &&
    route.steps.length > 0 &&
    route.steps.every((s: InterleavedStep) => s.status !== "il_pending");

  if (allDone) {
    const completed = route.steps.filter(
      (s: InterleavedStep) => s.status === "il_completed"
    ).length;
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <PartyPopper className="h-16 w-16 text-green-500" />
        <div>
          <h1 className="text-2xl font-bold">Route Complete</h1>
          <p className="mt-1 text-muted-foreground">
            {completed}/{route.steps.length} steps completed
          </p>
        </div>
        <Button
          className="h-16 w-full text-xl"
          size="lg"
          disabled={working}
          onClick={handleBuildRoute}
        >
          {working && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Start New Route
        </Button>
      </div>
    );
  }

  // --- No active route ---
  if (!route) {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <Route className="h-16 w-16 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold">Interleaved Routing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Combine picks, putaways, and replenishments into a single trip
          </p>
        </div>
        <Button
          className="h-16 w-full text-xl"
          size="lg"
          disabled={working}
          onClick={handleBuildRoute}
        >
          {working && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Start Route
        </Button>
      </div>
    );
  }

  // --- Active route ---
  const completedCount = route.steps.filter(
    (s: InterleavedStep) => s.status !== "il_pending"
  ).length;
  const totalSteps = route.steps.length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const nextPending = route.steps.find((s: InterleavedStep) => s.status === "il_pending");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Route</h1>
          <Badge variant="secondary" className="text-sm">
            {route.routeNumber}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive"
          disabled={working}
          onClick={handleCancel}
        >
          <XCircle className="mr-1 h-4 w-4" />
          Cancel Route
        </Button>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>
            {completedCount}/{totalSteps} steps
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-3 overflow-y-auto pb-4">
        {route.steps.map((step: InterleavedStep) => {
          const badge = STEP_BADGE[step.type] ?? { label: step.type, className: "" };
          const isNext = nextPending?.id === step.id;
          const isDone = step.status === "il_completed";
          const isSkipped = step.status === "il_skipped";

          return (
            <Card
              key={step.id}
              className={
                isNext
                  ? "border-primary ring-1 ring-primary"
                  : isDone || isSkipped
                    ? "opacity-50"
                    : ""
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {isDone && <Check className="h-5 w-5 text-green-500" />}
                      {isSkipped && <span className="text-xs text-muted-foreground">Skipped</span>}
                      {!isDone && !isSkipped && (
                        <span className="h-4 w-4 rounded-full border-2 border-muted-foreground inline-block" />
                      )}
                    </div>
                    <p className="mt-2 text-lg font-bold font-mono">{step.binId}</p>
                    <p className="truncate text-sm text-muted-foreground">{step.productId}</p>
                    <p className="text-sm font-medium">Qty: {step.quantity}</p>
                  </div>
                </div>

                {isNext && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="h-14 flex-1"
                      size="lg"
                      disabled={working}
                      onClick={() => handleComplete(step)}
                    >
                      {working ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-5 w-5" />
                      )}
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14"
                      disabled={working}
                      onClick={() => handleSkip(step)}
                    >
                      <SkipForward className="mr-1 h-4 w-4" />
                      Skip
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
