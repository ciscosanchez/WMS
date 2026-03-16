"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScanLine, Package, Printer, Check } from "lucide-react";

const mockPackingOrder = {
  orderNumber: "ORD-2026-0002",
  client: "ACME",
  shipTo: "Robert Fox, Denver CO",
  priority: "expedited",
  items: [{ sku: "VALVE-BV2", name: "2in Ball Valve", qty: 1, verified: false }],
  suggestedBox: "12×10×8",
};

export default function OperatorPackPage() {
  const [scanInput, setScanInput] = useState("");
  const [verified, setVerified] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pack</h1>
        <p className="text-sm text-muted-foreground">Verify items and pack for shipment</p>
      </div>

      {/* Scan order */}
      <div className="relative">
        <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Scan order or pick task barcode..."
          className="h-12 pl-10 text-lg"
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          autoFocus
        />
      </div>

      {/* Current packing order */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">{mockPackingOrder.orderNumber}</p>
              <p className="text-sm text-muted-foreground">
                {mockPackingOrder.client} → {mockPackingOrder.shipTo}
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-700">{mockPackingOrder.priority}</Badge>
          </div>

          {/* Items to verify */}
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              SCAN EACH ITEM TO VERIFY
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPackingOrder.items.map((item) => (
                  <TableRow key={item.sku}>
                    <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right text-lg font-bold">{item.qty}</TableCell>
                    <TableCell className="text-center">
                      {verified.includes(item.sku) ? (
                        <Check className="mx-auto h-5 w-5 text-green-600" />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVerified([...verified, item.sku])}
                        >
                          Scan
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Box suggestion */}
          <div className="mt-4 rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">SUGGESTED BOX</p>
                <p className="text-lg font-bold">{mockPackingOrder.suggestedBox}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1 h-12"
              size="lg"
              disabled={verified.length < mockPackingOrder.items.length}
            >
              <Printer className="mr-2 h-5 w-5" />
              Print Label & Complete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
