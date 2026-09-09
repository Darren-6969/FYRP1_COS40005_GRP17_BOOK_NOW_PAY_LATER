---
paths:
  - "prisma/**"
  - "src/db/**"
---

# Database and tenancy

Schema spec: `docs/srs/05-database-architecture.md` section 5.3.

## Row-level security

Prisma connects as a single database user and the DigitalOcean pool runs in
transaction mode, so session settings do not survive between statements. Every
tenant-scoped request runs inside an explicit transaction that sets the context
first:

```js
await withOperatorContext(operatorId, async (tx) => {
  return tx.booking.findMany({ /* ... */ });
});
```

- The raw Prisma client is **not exported**. Import the tenant-aware client.
- Allowlist for raw access: Identity and Platform modules, migration scripts.
- Policies use `current_setting(..., true)` so a request with no tenant context
  returns zero rows rather than failing open.
- Worker jobs carry tenant context in the job payload. Jobs that genuinely
  cross tenants (payout generation) connect under a role with `BYPASSRLS`, so
  crossing tenants is explicit and auditable rather than an accident of missing
  context.

> A payout job that runs without tenant context under an active policy returns
> zero rows and completes successfully having settled nothing. It fails
> silently, which is worse than failing loudly.

## Constraints that carry weight

Do not remove these to make a test pass.

- `listing_availability` PK `(listing_id, date)`, `CHECK remaining_quantity >= 0`
- `payment_schedules` UNIQUE `(id, booking_id)`; `payments` FK references the
  composite
- `documents` CHECK `num_nonnulls(user_id, operator_id) = 1`
- `user_platform_roles` PK `(user_id, role)` — one account may hold several
- `promo_redemptions.booking_id` UNIQUE
- `payout_items.commission_ledger_id` UNIQUE
- `webhook_events.external_event_id` UNIQUE

## Migrations

Incremental only. Never destructive to historical data. Rehearse against a
production-sized snapshot before running anywhere real; row counts per table
before and after must match or be explained.
