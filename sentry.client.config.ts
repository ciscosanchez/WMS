import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d173fa8d97c5c4506190f1504dbf10c2@o4511068093349888.ingest.sentry.io/4511068166422528",
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Only enable in production — avoids noise in local dev
  enabled: process.env.NODE_ENV === "production",
});
