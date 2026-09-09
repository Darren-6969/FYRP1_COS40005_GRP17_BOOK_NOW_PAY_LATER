---
paths:
  - "src/modules/inventory/**"
  - "prisma/migrations/**availability**"
---

# Inventory engine

Spec: `docs/srs/04-phase-2-platform-requirements.md` section 4.1.3 (FR-INV-001).

## Reservation is a single ranged statement

A multi-day booking must reserve every day or none. **Never loop over dates.**
A per-date loop passes the single-day concurrency test and silently allows
multi-day oversell, which is the most dangerous class of defect because the
test provides false assurance.

```sql
UPDATE listing_availability
   SET remaining_quantity = remaining_quantity - :qty
 WHERE listing_id = :listing_id
   AND date >= :service_start_date
   AND date <  :service_end_date
   AND is_blocked = false
   AND remaining_quantity >= :qty;
-- assert affected row count = expected number of days, else ROLLBACK
```

One statement means Postgres locks rows in a consistent order, which is what
avoids deadlock between two overlapping multi-day bookings.

This is the one deliberate exception to the ORM boundary (ADR-06): the Prisma
query builder cannot express it. Keep the raw SQL inside this module.

## Rules

- Affected row count is compared against the expected day count. Any shortfall
  rolls back and refuses the booking. A partial reservation is not a booking.
- A date with **no** availability row is unavailable. Treating a missing row as
  available allows unlimited overselling on unconfigured dates.
- Availability rows are generated 180 days forward by a nightly job.
- Cancellation, expiry, rejection and refusal release across the same range.
  Release must be idempotent so a repeated event does not over-credit.
- **`no_show` does not release inventory.** The operator held the asset.
- Reservation, the credit exposure check and the booking insert are one
  transaction.

## Tests that must keep passing

`docs/srs/11-test-strategy.md` 11.2.1 and 11.2.2. The multi-day overlap test is
the one that catches a naive implementation.
