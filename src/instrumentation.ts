export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Start BullMQ workers in-process ONLY when no dedicated worker service is running.
    // In production, set DISABLE_EMBEDDED_WORKERS=true and run workers separately via:
    //   npx tsx src/lib/jobs/worker-entrypoint.ts
    if (process.env.DISABLE_EMBEDDED_WORKERS !== "true") {
      const { startWorkers } = await import("@/lib/jobs/worker");
      startWorkers();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
