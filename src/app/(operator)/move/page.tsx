"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, ArrowRight } from "lucide-react";

export default function OperatorMovePage() {
  const [fromBin, setFromBin] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [toBin, setToBin] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Move Inventory</h1>
        <p className="text-sm text-muted-foreground">Transfer stock between bins</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">1. SCAN SOURCE BIN</label>
            <div className="relative mt-1">
              <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan bin barcode..."
                className="h-12 pl-10 text-lg"
                value={fromBin}
                onChange={(e) => setFromBin(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">2. SCAN PRODUCT</label>
            <div className="relative mt-1">
              <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan product barcode..."
                className="h-12 pl-10 text-lg"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">3. QUANTITY</label>
            <Input
              type="number"
              placeholder="Enter quantity..."
              className="mt-1 h-12 text-lg"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              4. SCAN DESTINATION BIN
            </label>
            <div className="relative mt-1">
              <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan destination bin..."
                className="h-12 pl-10 text-lg"
                value={toBin}
                onChange={(e) => setToBin(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="h-12 w-full"
            size="lg"
            disabled={!fromBin || !product || !quantity || !toBin}
          >
            Confirm Move
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
