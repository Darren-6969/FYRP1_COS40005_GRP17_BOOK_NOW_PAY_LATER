import "dotenv/config";
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
  enabled: Boolean(process.env.SENTRY_DSN),
  sendDefaultPii: false,
});

export { Sentry };