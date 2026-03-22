"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ramola-high-contrast";

/**
 * High-contrast mode toggle for warehouse operators.
 *
 * Adds/removes `data-high-contrast` attribute on <html>, which
 * CSS uses to override colors with maximum-contrast pairs.
 * Persisted in localStorage.
 */
export function useHighContrast() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    if (enabled) {
      document.documentElement.setAttribute("data-high-contrast", "true");
    } else {
      document.documentElement.removeAttribute("data-high-contrast");
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next) {
        document.documentElement.setAttribute("data-high-contrast", "true");
      } else {
        document.documentElement.removeAttribute("data-high-contrast");
      }
      return next;
    });
  }, []);

  return { highContrast: enabled, toggleHighContrast: toggle };
}
