"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { driverCheckIn } from "@/modules/yard-dock/yard-actions";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface CheckInFormProps {
  labels: {
    appointmentNumber: string;
    driverName: string;
    driverLicense: string;
    driverPhone: string;
    trailerNumber: string;
    checkInButton: string;
    success: string;
    successDesc: string;
    errorTitle: string;
    newCheckIn: string;
  };
}

export function CheckInForm({ labels }: CheckInFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const data = {
        appointmentNumber: formData.get("appointmentNumber") as string,
        driverName: formData.get("driverName") as string,
        driverLicense: (formData.get("driverLicense") as string) || undefined,
        driverPhone: (formData.get("driverPhone") as string) || undefined,
        trailerNumber: formData.get("trailerNumber") as string,
      };

      const res = await driverCheckIn(data);
      if (res.error) {
        setResult({ success: false, error: res.error });
      } else {
        setResult({ success: true });
      }
    });
  }

  if (result?.success) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">{labels.success}</h2>
          <p className="text-lg text-muted-foreground">{labels.successDesc}</p>
          <Button size="lg" className="mt-4 text-lg px-8 py-6" onClick={() => setResult(null)}>
            {labels.newCheckIn}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">{labels.checkInButton}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          {result?.error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <XCircle className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">{labels.errorTitle}</div>
                <div className="text-sm">{result.error}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="appointmentNumber" className="text-lg">
              {labels.appointmentNumber}
            </Label>
            <Input
              id="appointmentNumber"
              name="appointmentNumber"
              required
              autoFocus
              placeholder="APPT-..."
              className="text-xl h-14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverName" className="text-lg">
              {labels.driverName}
            </Label>
            <Input id="driverName" name="driverName" required className="text-lg h-12" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverLicense" className="text-lg">
              {labels.driverLicense}
            </Label>
            <Input id="driverLicense" name="driverLicense" className="text-lg h-12" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverPhone" className="text-lg">
              {labels.driverPhone}
            </Label>
            <Input id="driverPhone" name="driverPhone" type="tel" className="text-lg h-12" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trailerNumber" className="text-lg">
              {labels.trailerNumber}
            </Label>
            <Input id="trailerNumber" name="trailerNumber" required className="text-xl h-14" />
          </div>

          <Button type="submit" size="lg" disabled={isPending} className="w-full text-xl h-16">
            {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {labels.checkInButton}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
