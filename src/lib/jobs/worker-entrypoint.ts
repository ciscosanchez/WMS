/**
 * Standalone BullMQ worker entrypoint.
 *
 * Run separately from Next.js:
 *   npx tsx src/lib/jobs/worker-entrypoint.ts
 *
 * Or via Docker as a separate service.
 * This keeps background job processing isolated from the web process.
 */

import { startWorkers } from "./worker";

console.log("[worker] Starting standalone BullMQ worker process...");
startWorkers();

// Keep the process alive
process.on("SIGINT", () => {
  console.log("[worker] Shutting down...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("[worker] Shutting down...");
  process.exit(0);
});
