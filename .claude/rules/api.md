---
paths:
  - "src/api/**"
  - "src/routes/**"
  - "openapi.yaml"
---

# API conventions

## Versioning

All routes under `/v1`. Once the mobile app is published there is a client that
cannot be force-updated, and adding a prefix retrospectively breaks every
client at once.

## Error contract

```json
{
  "code": "BOOKING_STOCK_INSUFFICIENT",
  "message": "Selected dates are no longer available",
  "request_id": "req_01HZX...",
  "details": { "unavailable_dates": ["2026-08-14"] }
}
```

- Clients branch on `code`, never on `message`. Message text is for display and
  may be localised.
- Register every new code in `src/errors/codes.ts`. Do not invent codes inline.
- `request_id` is generated per request, returned in the response, attached to
  every log line for that request, and sent to the error tracker.
- HTTP status carries its standard meaning; `code` carries the business reason.

## Contract

Any API change updates `openapi.yaml` in the same pull request. Three web
surfaces and a mobile app build against it.
