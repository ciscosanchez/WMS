/**
 * Structured JSON logger for WMS.
 *
 * - Development: pretty-prints to console with colors.
 * - Production: emits single-line JSON to stdout for log aggregation.
 *
 * No external dependencies (no pino) — just a lightweight wrapper.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

function buildEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error !== undefined && error !== null) {
    entry.error = {
      name: "UnknownError",
      message: String(error),
    };
  }

  return entry;
}

const isDev = process.env.NODE_ENV !== "production";

function emit(entry: LogEntry) {
  if (isDev) {
    // Pretty-print for local development
    const color =
      entry.level === "error" ? "\x1b[31m" : entry.level === "warn" ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`;
    const ts = entry.timestamp.slice(11, 23); // HH:mm:ss.SSS

    const consoleFn =
      // eslint-disable-next-line no-console -- this IS the logger; console.log is intentional
      entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;

    consoleFn(`${ts} ${prefix} ${entry.message}`);
    if (entry.context) {
      consoleFn("  context:", entry.context);
    }
    if (entry.error) {
      consoleFn("  error:", entry.error.message);
      if (entry.error.stack) {
        consoleFn("  stack:", entry.error.stack);
      }
    }
  } else {
    // Production: single-line JSON to stdout
    const out = JSON.stringify(entry);
    if (entry.level === "error") {
      process.stderr.write(out + "\n");
    } else {
      process.stdout.write(out + "\n");
    }
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    emit(buildEntry("info", message, context));
  },

  warn(message: string, context?: Record<string, unknown>) {
    emit(buildEntry("warn", message, context));
  },

  error(message: string, context?: Record<string, unknown>, error?: unknown) {
    emit(buildEntry("error", message, context, error));
  },
};
