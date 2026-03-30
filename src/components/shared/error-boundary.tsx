"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component. When omitted the default error card is shown. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary that:
 * 1. Catches render errors in the subtree.
 * 2. Reports them to Sentry.
 * 3. Shows a user-friendly error card with retry + dashboard links.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorCard error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// ── Default error card ──────────────────────────────────────────────────────

interface ErrorCardProps {
  error: Error | null;
  onReset: () => void;
}

export function ErrorCard({ error, onReset }: ErrorCardProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-foreground">Something went wrong</h2>

        <p className="mb-6 text-sm text-muted-foreground">
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
