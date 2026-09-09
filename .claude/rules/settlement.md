---
paths:
  - "src/modules/settlement/**"
---

# Settlement and commission

Spec: `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` 3.1.4
and 3.1.5.

## The formulas

`G` gross before discount, `D` discount, `N = G - D` charged, `r` fee rate,
`S` Stripe processing fee.

```
funded_by = operator   (operator absorbs the discount)
  fee_amount   = round(N * r)
  operator_net = N - fee_amount - S
  platform_margin = fee_amount

funded_by = platform   (platform absorbs the discount)
  fee_amount   = round(G * r)
  operator_net = G - fee_amount - S
  platform_margin = fee_amount - D      # goes NEGATIVE when D > G*r
```

Negative platform margin on a platform-funded promotion is a deliberate
marketing decision, not a bug. It must be visible rather than accidental: a
campaign whose max discount exceeds `G * r` is rejected at creation unless an
admin sets an explicit override, and the override is audit logged.

## Rules

- `fee_rate` and `funded_by` are **snapshotted onto the ledger entry at payment
  time**. Later configuration changes must not retroactively alter history.
- `stripe_fee_amount` is its own column and is never folded into `fee_amount`.
  The ledger must reconcile line by line against the Stripe balance report.
- Settlement is service-completion based. Only bookings that reached
  `completed` or a no-show terminal state, with the appeal window closed, are
  settleable.
- `payout_items.commission_ledger_id` is unique. A ledger entry can never
  appear in two payouts.
- Payout generation crosses tenants and therefore runs under the system
  database role, not a tenant context. See `.claude/rules/database.md`.
- All amounts integer sen.
