"use client";

import { useEffect, useCallback, useRef, useState } from "react";

/**
 * Hook for barcode scanner integration.
 *
 * Supports two modes:
 * 1. Hardware scanner (keyboard wedge) — scanner types characters rapidly, ending with Enter
 * 2. Camera scanner — uses device camera via getUserMedia + BarcodeDetector API
 *
 * Hardware scanners are detected by rapid keystrokes (< 50ms between characters)
 * followed by Enter. Regular typing is too slow to trigger.
 */

interface UseBarcodeScanner {
  /** Last scanned barcode value */
  barcode: string | null;
  /** Whether actively listening for scans */
  isListening: boolean;
  /** Start listening for barcode scans */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Clear the last scanned barcode */
  clear: () => void;
  /** Whether camera scanning is supported */
  cameraSupported: boolean;
  /** Start camera-based scanning */
  startCamera: () => void;
  /** Stop camera scanning */
  stopCamera: () => void;
  /** Whether camera is active */
  cameraActive: boolean;
}

interface ScannerOptions {
  /** Called when a barcode is successfully scanned */
  onScan?: (barcode: string) => void;
  /** Minimum characters for a valid barcode (default: 3) */
  minLength?: number;
  /** Maximum time between keystrokes in ms (default: 50) */
  maxKeystrokeDelay?: number;
  /** Auto-start listening on mount (default: true) */
  autoStart?: boolean;
  /** Prevent default on Enter when barcode detected (default: true) */
  preventDefault?: boolean;
}

export function useBarcodeScanner(options: ScannerOptions = {}): UseBarcodeScanner {
  const {
    onScan,
    minLength = 3,
    maxKeystrokeDelay = 50,
    autoStart = true,
    preventDefault = true,
  } = options;

  const [barcode, setBarcode] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(autoStart);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return "BarcodeDetector" in window || "mediaDevices" in navigator;
  });

  const bufferRef = useRef("");
  const lastKeystrokeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isListening) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeRef.current;

      if (e.key === "Enter") {
        // Check if buffer looks like a barcode scan (rapid input)
        if (bufferRef.current.length >= minLength) {
          const scannedValue = bufferRef.current.trim();
          setBarcode(scannedValue);
          onScan?.(scannedValue);

          if (preventDefault) {
            e.preventDefault();
            e.stopPropagation();
          }

          // Play success sound
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.value = 1200;
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
          } catch {
            // Audio not available
          }
        }
        bufferRef.current = "";
        return;
      }

      // If too much time passed, reset buffer (regular typing, not a scan)
      if (timeSinceLastKey > maxKeystrokeDelay && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // Only capture printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        lastKeystrokeRef.current = now;
      }
    },
    [isListening, minLength, maxKeystrokeDelay, onScan, preventDefault]
  );

  useEffect(() => {
    if (isListening) {
      document.addEventListener("keydown", handleKeyDown, true);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isListening, handleKeyDown]);

  const startListening = useCallback(() => setIsListening(true), []);
  const stopListening = useCallback(() => {
    setIsListening(false);
    bufferRef.current = "";
  }, []);
  const clear = useCallback(() => setBarcode(null), []);

  const startCamera = useCallback(async () => {
    if (!cameraSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);

      // If BarcodeDetector API is available, use it
      if ("BarcodeDetector" in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "qr_code"],
        });

        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();
        videoRef.current = video;

        const scan = async () => {
          if (!streamRef.current) return;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue;
              setBarcode(value);
              onScan?.(value);
              stopCamera();
              return;
            }
          } catch {
            // Detection failed, retry
          }
          if (streamRef.current) {
            requestAnimationFrame(scan);
          }
        };

        video.onloadedmetadata = () => scan();
      }
    } catch {
      setCameraActive(false);
    }
  }, [cameraSupported, onScan]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    barcode,
    isListening,
    startListening,
    stopListening,
    clear,
    cameraSupported,
    startCamera,
    stopCamera,
    cameraActive,
  };
}
