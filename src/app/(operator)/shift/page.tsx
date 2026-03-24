"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Coffee, CheckCircle2, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyActiveShift, clockIn, clockOut, addBreakTime } from "@/modules/labor/actions";

type Shift = Awaited<ReturnType<typeof getMyActiveShift>>;

function formatHoursWorked(clockInTime: string | Date): string {
  const start = new Date(clockInTime).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export default function OperatorShiftPage() {
  const [shift, setShift] = useState<Shift>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const t = useTranslations("operator.shift");

  const loadShift = useCallback(async () => {
    try {
      const data = await getMyActiveShift();
      setShift(data);
      if (data?.clockIn) {
        setElapsed(formatHoursWorked(data.clockIn));
      }
    } catch {
      toast.error("Failed to load shift");
    }
  }, []);

  useEffect(() => {
    loadShift().finally(() => setLoading(false));
  }, [loadShift]);

  // Update elapsed time every 30 seconds when clocked in
  useEffect(() => {
    if (!shift?.clockIn) return;
    const interval = setInterval(() => {
      setElapsed(formatHoursWorked(shift.clockIn));
    }, 30000);
    return () => clearInterval(interval);
  }, [shift]);

  async function handleClockIn() {
    setWorking(true);
    try {
      const result = await clockIn();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("shiftStarted"));
        await loadShift();
      }
    } catch {
      toast.error("Clock in failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleClockOut() {
    setWorking(true);
    try {
      const result = await clockOut();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("clockOut"));
        setShift(null);
        setElapsed("");
      }
    } catch {
      toast.error("Clock out failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddBreak(minutes: number) {
    setWorking(true);
    try {
      const result = await addBreakTime(minutes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`+${minutes} ${t("minutes")}`);
        await loadShift();
      }
    } catch {
      toast.error("Failed to add break");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isClockedIn = !!shift;

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-center pt-4">
        <Badge variant={isClockedIn ? "default" : "secondary"} className="px-4 py-2 text-base">
          {isClockedIn ? t("clockedIn") : t("notClockedIn")}
        </Badge>
      </div>

      {/* Clock In / Clock Out */}
      {!isClockedIn ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Clock className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("clockInFirst")}</p>
            <Button
              className="h-16 w-full text-xl"
              size="lg"
              disabled={working}
              onClick={handleClockIn}
            >
              {working && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {t("clockIn")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Shift Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="flex flex-col items-center py-4">
                <Clock className="mb-1 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("hoursWorked")}</p>
                <p className="text-2xl font-bold">{elapsed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center py-4">
                <Coffee className="mb-1 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("breakTime")}</p>
                <p className="text-2xl font-bold">{shift.breakMinutes ?? 0}m</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center py-4">
                <CheckCircle2 className="mb-1 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("tasksToday")}</p>
                <p className="text-2xl font-bold">{shift._count?.taskTimeLogs ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center py-4">
                <Package className="mb-1 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("unitsToday")}</p>
                <p className="text-2xl font-bold">{shift._sum?.unitsHandled ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Break Time Buttons */}
          <Card>
            <CardContent className="py-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">{t("addBreak")}</p>
              <div className="grid grid-cols-3 gap-3">
                {[15, 30, 60].map((mins) => (
                  <Button
                    key={mins}
                    variant="outline"
                    className="h-12 text-lg"
                    disabled={working}
                    onClick={() => handleAddBreak(mins)}
                  >
                    +{mins} {t("minutes")}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Clock Out with Confirm */}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  className="h-16 w-full text-xl"
                  size="lg"
                  disabled={working}
                />
              }
            >
              {working && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {t("clockOut")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmClockOut")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("hoursWorked")}: {elapsed}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel") ?? "Cancel"}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClockOut}>{t("clockOut")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
