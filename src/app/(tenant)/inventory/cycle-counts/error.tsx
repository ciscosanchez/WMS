"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorCard } from "@/components/shared/error-boundary";

export default function CycleCountsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorCard error={error} onReset={reset} />;
}
