"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Check } from "lucide-react";
import { toast } from "sonner";

const mockPendingShipments = [
  {
    id: "2",
    number: "ASN-2026-0002",
    client: "GLOBEX",
    carrier: "XPO",
    status: "arrived",
    lines: 5,
    received: 2,
  },
  {
    id: "3",
    number: "ASN-2026-0003",
    client: "INITECH",
    carrier: "SAIA",
    status: "arrived",
    lines: 2,
    received: 0,
  },
];

export default function OperatorReceivePage() {
  function handleScan(value: string) {
    const match = mockPendingShipments.find((s) => s.number === value || value.includes(s.number));
    if (match) {
      toast.success(`Found shipment ${match.number}`);
    } else {
      toast.error(`No shipment found for: ${value}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Receive</h1>
        <p className="text-sm text-muted-foreground">Scan BOL or select shipment</p>
      </div>

      {/* Scan input — supports hardware scanner + camera */}
      <BarcodeScannerInput
        placeholder="Scan BOL or ASN barcode..."
        onScan={handleScan}
        showFeedback
      />

      {/* Camera button integrated into BarcodeScannerInput */}

      {/* Pending shipments */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          ARRIVED — READY TO RECEIVE
        </h2>
        <div className="space-y-3">
          {mockPendingShipments.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{s.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.client} &middot; {s.carrier}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">
                      {s.received}/{s.lines} lines received
                    </span>
                  </div>
                </div>
                <Button size="lg">{s.received > 0 ? "Continue" : "Start"}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent completions */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">COMPLETED TODAY</h2>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">ASN-2026-0001</p>
              <p className="text-sm text-muted-foreground">ACME &middot; FedEx Freight</p>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Done</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
