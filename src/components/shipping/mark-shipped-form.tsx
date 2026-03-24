"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markShipmentShipped } from "@/modules/shipping/ship-actions";
import { toast } from "sonner";
import { Truck } from "lucide-react";

const CARRIERS = ["UPS", "FedEx", "USPS", "DHL", "OnTrac", "LSO", "Other"];

interface MarkShippedFormProps {
  shipmentId: string;
  currentCarrier?: string | null;
}

export function MarkShippedForm({ shipmentId, currentCarrier }: MarkShippedFormProps) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(currentCarrier ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error("Tracking number is required");
      return;
    }
    startTransition(async () => {
      const result = await markShipmentShipped(shipmentId, trackingNumber.trim(), carrier.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Shipment marked as shipped");
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Mark as Shipped
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="carrier">Carrier</Label>
            <select
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">— select —</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-48">
            <Label htmlFor="tracking">
              Tracking Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tracking"
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Mark Shipped"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
