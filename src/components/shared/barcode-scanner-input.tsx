"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Camera, Check, X } from "lucide-react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { cn } from "@/lib/utils";

interface BarcodeScannerInputProps {
  placeholder?: string;
  onScan: (value: string) => void;
  value?: string;
  className?: string;
  autoFocus?: boolean;
  /** Show success state briefly after scan */
  showFeedback?: boolean;
  /** Expected value for validation (optional) */
  expectedValue?: string;
}

export function BarcodeScannerInput({
  placeholder = "Scan barcode...",
  onScan,
  value: externalValue,
  className,
  autoFocus = true,
  showFeedback = true,
  expectedValue,
}: BarcodeScannerInputProps) {
  const [manualInput, setManualInput] = useState("");
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  function handleScanned(value: string) {
    if (showFeedback) {
      if (expectedValue && value !== expectedValue) {
        setFeedback("error");
        // Vibrate on error (mobile)
        navigator.vibrate?.([200, 100, 200]);
      } else {
        setFeedback("success");
        // Vibrate on success (mobile)
        navigator.vibrate?.([100]);
      }
      setTimeout(() => setFeedback(null), 1500);
    }

    if (!expectedValue || value === expectedValue) {
      onScan(value);
    }
  }

  const { barcode, clear, cameraSupported, startCamera, cameraActive } = useBarcodeScanner({
    onScan: (scanned) => {
      handleScanned(scanned);
    },
  });

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScanned(manualInput.trim());
      setManualInput("");
    }
  }

  // Sync external value to manual input
  const prevExternalValue = useRef(externalValue);
  if (externalValue !== undefined && externalValue !== prevExternalValue.current) {
    prevExternalValue.current = externalValue;
    setManualInput(externalValue);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine
            className={cn(
              "absolute left-3 top-3.5 h-5 w-5",
              feedback === "success"
                ? "text-green-500"
                : feedback === "error"
                  ? "text-red-500"
                  : "text-muted-foreground"
            )}
          />
          <Input
            placeholder={placeholder}
            className={cn(
              "h-12 pl-10 text-lg font-mono",
              feedback === "success" && "border-green-500 ring-1 ring-green-500",
              feedback === "error" && "border-red-500 ring-1 ring-red-500"
            )}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            autoFocus={autoFocus}
          />
          {feedback === "success" && (
            <Check className="absolute right-3 top-3.5 h-5 w-5 text-green-500" />
          )}
          {feedback === "error" && <X className="absolute right-3 top-3.5 h-5 w-5 text-red-500" />}
        </div>
        {cameraSupported && (
          <Button
            type="button"
            variant={cameraActive ? "default" : "outline"}
            size="lg"
            onClick={() => (cameraActive ? clear() : startCamera())}
          >
            <Camera className="h-5 w-5" />
          </Button>
        )}
      </form>

      {barcode && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Last scan: {barcode}
          </Badge>
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {expectedValue && (
        <p className="text-xs text-muted-foreground">
          Expected: <span className="font-mono">{expectedValue}</span>
        </p>
      )}
    </div>
  );
}
