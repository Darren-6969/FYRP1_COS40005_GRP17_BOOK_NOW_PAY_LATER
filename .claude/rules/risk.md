---
paths:
  - "src/modules/risk/**"
---

# Credit risk

Spec: `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` 3.5.

## Tiers

| Tier | Condition | Payment plan | Max concurrent unpaid |
| --- | --- | --- | --- |
| Normal | new or clean | full amount, 24h | 2 |
| Trusted | 3+ paid, 0 expired | full amount, 36h | 5 |
| Caution | 2 expired | 30% deposit in 12h + 70% 24h before service | 1 |
| High Risk | 3+ expired or 1+ no-show | full prepayment required | 0 |

Thresholds and limits are configuration in `system_settings`, not constants.

## Rules

- **Risk never reads the `bookings` table.** Counters in
  `customer_risk_profiles` are maintained incrementally from events the
  orchestrator sends. This is what keeps the module out of a dependency cycle.
- The exposure check runs inside the same transaction as the inventory
  reservation. Checking a limit in one transaction and acting in another is
  not a limit.
- A booking refused by the exposure cap is **not** a negative credit event.
- Credit history is append-only. An upheld appeal writes a new reversing event
  pointing at the original; never modify or delete the original.
- Downgrades are automatic. Upgrades need positive history or manual review.

## No-show outcomes

Five terminal cases, full matrix in the spec at 3.5.4. The two that are easy to
get wrong:

- Paid in full, absent -> `no_show`, inventory not released, full net settles
  after the appeal window.
- Deposit paid, balance unpaid, absent -> `no_show_unpaid`, outstanding
  schedule entries **voided**, deposit forfeited in full to the operator, and
  **only the deposit** becomes settleable.

A `no_show_unpaid` booking must never become settleable for money that was
never collected. That was the defect this design exists to fix.
