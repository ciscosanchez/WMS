export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Start BullMQ workers for background job processing
    const { startWorkers } = await import("@/lib/jobs/worker");
    startWorkers();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
