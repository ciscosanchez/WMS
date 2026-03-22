"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours (full shift)
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

/**
 * Keeps the operator session alive during a warehouse shift.
 *
 * - Pings /api/auth/session every 10 minutes while active
 * - Resets idle timer on any user interaction
 * - After 12 hours of total inactivity, prompts re-auth
 * - Does NOT aggressively log out — shows a gentle re-auth prompt
 */
export function useSessionKeepalive() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const lastActivityRef = useRef(0);

  // Initialize ref on mount (avoids impure call during render)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordActivity = useCallback(() => {
    // Only update idle timer — never dismiss the expired overlay.
    // The overlay can only be dismissed via refreshSession().
    lastActivityRef.current = Date.now();
  }, []);

  const pingSession = useCallback(async () => {
    // Only ping if user was active in the last ping interval
    const idleMs = Date.now() - lastActivityRef.current;
    if (idleMs > PING_INTERVAL * 2) return;

    try {
      const res = await fetch("/api/auth/session", { method: "GET" });
      if (res.status === 401) {
        setSessionExpired(true);
      }
    } catch {
      // Network error — offline handling takes care of this
    }
  }, []);

  const checkIdle = useCallback(() => {
    const idleMs = Date.now() - lastActivityRef.current;
    if (idleMs >= IDLE_TIMEOUT) {
      setSessionExpired(true);
    }
  }, []);

  useEffect(() => {
    // Listen for activity
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    // Periodic session ping
    pingIntervalRef.current = setInterval(pingSession, PING_INTERVAL);

    // Periodic idle check
    idleCheckRef.current = setInterval(checkIdle, 60_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, [recordActivity, pingSession, checkIdle]);

  const refreshSession = useCallback(() => {
    setSessionExpired(false);
    lastActivityRef.current = Date.now();
    // Navigate to login which will redirect back after auth
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
  }, []);

  return { sessionExpired, refreshSession };
}
