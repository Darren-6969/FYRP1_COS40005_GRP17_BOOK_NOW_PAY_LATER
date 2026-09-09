---
paths:
  - "src/modules/payment/**"
  - "src/api/webhooks/**"
---

# Payments

Spec: `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` 3.1
and 3.5.5.

## Payment schedules

All due payments live in `payment_schedules`. There is no single deadline field.
Deposits, balances and any future instalment plan share one monitoring path,
and every scheduled job works from `due_date`.

When a booking reaches a terminal state, outstanding entries are **voided**,
never deleted. The record of what was owed is part of the audit trail.

## Webhooks

The endpoint does the minimum and returns fast:

1. Verify the signature against the **raw request body**. Register this route
   before any JSON body-parsing middleware.
2. Insert into `webhook_events`; the unique constraint on `external_event_id`
   catches duplicate delivery.
3. Enqueue a processing job.
4. Return 200.

Processing happens in the worker. Payment providers retry endpoints that
respond slowly, and a bug in commission calculation must not make Stripe
consider delivery failed.

The webhook can arrive **before** the customer returns from the payment page.
The result page polls booking status; it never treats the redirect as
authoritative.

## Rules

- Every write endpoint requires an `Idempotency-Key`. Cached responses are
  returned for repeats.
- `payments` references `payment_schedules` by composite foreign key
  `(payment_schedule_id, booking_id)`, so a payment cannot reference a schedule
  belonging to a different booking.
- Money is integer sen throughout.
