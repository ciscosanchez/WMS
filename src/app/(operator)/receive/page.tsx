"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScanLine, Camera, Package, Check } from "lucide-react";

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
  const [scanInput, setScanInput] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Receive</h1>
        <p className="text-sm text-muted-foreground">Scan BOL or select shipment</p>
      </div>

      {/* Scan input — large, optimized for barcode scanners */}
      <div className="relative">
        <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Scan BOL or ASN barcode..."
          className="h-12 pl-10 text-lg"
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          autoFocus
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-12">
          <Camera className="mr-2 h-5 w-5" />
          Scan BOL Photo
        </Button>
        <Button variant="outline" className="flex-1 h-12">
          <Package className="mr-2 h-5 w-5" />
          Manual Entry
        </Button>
      </div>

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
