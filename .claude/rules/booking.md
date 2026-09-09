---
paths:
  - "src/modules/booking/**"
  - "src/orchestrators/**"
---

# Booking and orchestration

Spec: `docs/srs/04-phase-2-platform-requirements.md` 4.2.4, and the sequence
diagram in `docs/srs/06-system-architecture.md` 6.3.1.

## Booking creation transaction

Outside the transaction (reads): price calculation, promotion validation,
credit tier lookup. Holding a transaction open across these lengthens the
window during which inventory rows are locked.

Inside one transaction:

1. exposure check (Risk)
2. inventory reservation (Inventory)
3. booking insert + status history (Booking)
4. payment schedule generation (Payment)
5. promotion redemption (Promotion)
6. notification job enqueued (Platform)

If any step fails, everything rolls back. A booking never exists without its
inventory, and inventory is never held without a booking.

## Orchestrator discipline

Orchestrators **sequence calls and manage the transaction**. Any conditional
business rule belongs in a module. If an orchestrator is growing branches, the
logic is in the wrong place.

## Rules

- `service_start_at`, `service_end_at` and `quantity` are columns, not JSON.
  Inventory, payment schedules, no-show marking and settlement all depend on
  them being queryable.
- Every status change writes a `booking_status_history` row. Invalid
  transitions are rejected.
- Terminal states: `completed`, `cancelled`, `expired`, `no_show`,
  `no_show_unpaid`, `rejected`.
- The promotion applied to a booking is read from `promo_redemptions`. There is
  no `promotion_id` on `bookings`; keeping it in two places was the dual source
  of truth problem already fixed for roles.
