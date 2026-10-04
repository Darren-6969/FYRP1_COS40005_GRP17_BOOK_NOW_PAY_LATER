# Observability

## Exception capture

Set `SENTRY_DSN` and `SENTRY_ENVIRONMENT` for the backend, and `VITE_SENTRY_DSN` and `VITE_SENTRY_ENVIRONMENT` for the frontend build. Sentry remains disabled when its DSN is empty. The frontend strips request headers, cookies, bodies, and query strings before sending events. Backend exceptions include stack traces in structured logs and are flushed to Sentry before the error response is completed.

## Request correlation

The frontend sends a UUID in `X-Request-ID`. The backend validates and reuses it, returns it in the same response header and in error bodies, and includes it in request logs and audit records. Search Sentry events using the `request_id` tag, then use the same ID in structured backend logs or the `AuditLog.requestId` field.

## Error-rate alert

The backend emits an `http_error_rate_spike` structured event and Sentry message after 20 HTTP 5xx responses within five minutes per warm process. `ERROR_RATE_WINDOW_MS` and `ERROR_RATE_THRESHOLD` change that local threshold; `ERROR_ALERT_WEBHOOK_URL` can notify a Slack-compatible incoming webhook.

Because Vercel runs serverless instances, configure a Sentry **Metric Alert** for the project-wide rate as well: aggregate `count()` over error events in the `production` environment, trigger above 20 events in five minutes, and notify the on-call email/Slack integration. This aggregates across instances and is the authoritative production alert; the in-process webhook is an additional early warning. Configure the Sentry rule and notification destination in the Sentry project, since those are account-specific and require an organization/project and notification integration.

## Retention

Booking/payment audit events are stored in `AuditLog`; settlement calculations are stored in `CommissionLedgerEntry`. The application has no retention or cleanup job for either table. Keep database backups and provider retention policies configured to preserve these records permanently. Sentry event retention is controlled by the Sentry organization plan.