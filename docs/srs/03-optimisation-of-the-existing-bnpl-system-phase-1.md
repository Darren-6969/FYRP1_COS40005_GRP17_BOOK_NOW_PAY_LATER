<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 3. Optimisation of the Existing BNPL System (Phase 1, Mandatory)

This part covers foundational improvements to the current system. It does not depend on Phase 2 functionality and is implemented first, to provide a stable technical base for the platform build.

## 3.1 Order and Payment Reliability

### 3.1.1 Booking Idempotency Control

**Requirement ID:** FR-REL-001

All booking creation endpoints require an idempotency key. The client generates a unique identifier when submitting a booking and the server stores the key together with the resulting booking. A repeated request carrying the same key returns the existing booking rather than creating a second one. This covers booking submission and payment callbacks. Idempotency records are persisted and expired automatically after a configured retention period.

**Design reason:** The current system has no idempotency check. Network retries, repeated form submission and upstream re-delivery all create duplicate bookings, which causes reconciliation problems and customer complaints.

**Business value:** Eliminates duplicate bookings and duplicate payments, reduces reconciliation effort, and raises confidence in the transaction path.

### 3.1.2 Payment Callback Closure and Retry

**Requirement ID:** FR-REL-002

- Stripe and DuitNow callback signatures and parameters are strictly validated to prevent forged payment notifications
- Callback handling is idempotent. A repeated callback for the same payment event does not update the order state a second time, and every callback event is persisted in full
- An active reconciliation job polls pending payments approaching their due date and queries the payment gateway directly to update any order whose callback was lost
- Failed callbacks and notifications enter a retry queue with exponential backoff, capped at five attempts

**Design reason:** The current callback path relies on a single delivery. Network instability, service restarts and gateway faults all cause lost callbacks, producing the state where a customer has paid but the order is not updated.

**Business value:** Keeps payment state and order state consistent, prevents bad debt and complaints, and reduces manual verification work.

### 3.1.3 Scheduled Task Fault Tolerance and Monitoring

**Requirement ID:** FR-REL-003

- Every scheduled task writes an execution log recording task name, start and end time, records processed, failures and error detail
- A failed task retries automatically, and a single failure does not affect the overall schedule
- A daily sweep scans all overdue and unprocessed orders once per day, completing any cancellation and notification that was missed
- Scheduled tasks acquire a PostgreSQL advisory lock before running, so that a job cannot execute twice if the application runs on more than one instance

**Design reason:** The current cron implementation has no execution state. A single failure leaves that batch of expired orders unprocessed, and the platform moves from Vercel Cron to a self-managed scheduler, where duplicate execution across instances becomes possible.

**Business value:** Guarantees that the payment deadline cancellation flow always runs, and provides observability so that scheduler faults can be located quickly.

### 3.1.4 Settlement and Commission (Stripe Connect Retained and Enhanced)

**Requirement ID:** FR-FIN-001

- The existing Stripe Connect capability is retained. Each operator is bound to an independent Stripe Express account
- Settlement follows a service-completion principle. An order becomes eligible for settlement only after its status reaches completed or no_show and any dispute window has closed, which avoids having to reclaim funds after a cancellation or refund
- A commission ledger entry is written for every successful payment, recording gross amount, discount, net amount, commission rate, commission amount, payment processing fee and the operator net amount
- Settlement cycles are configurable, either automatic weekly settlement or manual payout, producing a payout record with itemised detail that the operator can review

**Design reason:** The original refactor plan omitted the settlement data model, which would have caused a regression against a capability already delivered in Phase 1. A multi-tenant platform requires a complete order to payment to commission to payout chain, otherwise it cannot support real commercial operation.

**Business value:** Retains and strengthens an existing core capability, produces a complete and auditable financial chain, and supports independent settlement per operator.

### 3.1.5 Commission Calculation and Promotion Cost Attribution

**Requirement ID:** FR-FIN-002

Every promotion declares who bears its cost through the funded_by field. The commission calculation differs by case, and the formula must be explicit so that reconciliation is unambiguous. The following symbols are used, where G is the gross amount before discount, D is the discount amount, N is the net amount actually charged, r is the commission rate and S is the payment processing fee charged by Stripe.

```
N = G - D

Case 1: funded_by = operator   (the operator absorbs the discount)
  fee_amount   = round(N * r)
  operator_net = N - fee_amount - S
  platform_margin = fee_amount

Case 2: funded_by = platform   (the platform absorbs the discount)
  fee_amount   = round(G * r)
  operator_net = G - fee_amount - S
  platform_margin = fee_amount - D
```

In case 2 the operator is made whole, so the platform margin falls as the discount rises and becomes negative once the discount exceeds the commission the platform would have earned. This is a deliberate marketing decision rather than an error, but it must be visible rather than accidental.

- A platform-funded promotion whose maximum discount exceeds G multiplied by r is rejected at creation time unless an administrator sets an explicit override flag, and the override is written to the audit log
- The fee_rate and funded_by values in force at the time of payment are copied onto the commission ledger entry, so that later configuration changes do not retroactively alter historical records
- The payment processing fee is stored in its own column and is never folded into the commission amount, so that the ledger reconciles line by line against the Stripe balance report

**Worked example:** A booking of MYR 500 with a MYR 60 platform-funded discount and a 10 percent commission rate produces fee_amount of MYR 50, operator_net of MYR 450 less the processing fee, and a platform margin of negative MYR 10. Under the same booking with an operator-funded discount, fee_amount is MYR 44, operator_net is MYR 396 less the processing fee, and the platform margin is MYR 44.

**Design reason:** V2.1 introduced funded_by and split the ledger amounts but never stated the arithmetic, leaving it undefined whether the commission base was the pre-discount or post-discount amount and whether the operator or the platform absorbed a platform campaign.

**Business value:** Removes financial ambiguity, allows operators to accept platform-wide promotion codes with confidence, and makes platform margin on marketing campaigns explicit and controllable.

## 3.2 Multi-tenancy and Permissions

### 3.2.1 Layered Configuration

**Requirement ID:** FR-SEC-001

The single BNPLConfig table is split into two layers. SystemSettings holds global platform configuration including platform name, default payment rules, the global commission rate and global switches, maintained by the administrator. OperatorSettings holds per-operator configuration including payment deadline, deposit percentage, the no-show marking window and notification preferences, maintained by the operator.

**Design reason:** The original single configuration table mixed global and tenant-level settings, which becomes unmanageable under multi-tenancy and allows configuration values to override one another unpredictably.

**Business value:** Draws a clear boundary between platform and operator configuration and supports per-tenant operation.

### 3.2.2 Multi-tenant Data Isolation

**Requirement ID:** FR-SEC-002

- A Prisma middleware layer injects the tenant filter automatically, appending the operator condition to every tenant-scoped query so that it cannot be forgotten in application code
- Core business tables enable PostgreSQL row-level security, so that cross-operator access is refused by the database itself even if the middleware is bypassed
- Cross-tenant operations are permitted only for the administrator role and are always written to the audit log

Row-level security requires an explicit session mechanism, because Prisma connects using a single database user and the DigitalOcean connection pool operates in transaction mode, where session-level settings do not survive between statements. Every tenant-scoped request therefore runs inside an explicit transaction whose first statement establishes the tenant context.

```
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config(
    'app.current_operator_id', ${operatorId}, true)`;   // true = transaction-local
  return tx.booking.findMany({ /* ... */ });
});
```

The policy on each protected table compares the operator column against current_setting with the missing_ok argument set, so that a request arriving without a tenant context returns no rows rather than failing open.

**Design reason:** V2.1 asserted row-level security without stating how the tenant context reaches the database. Without this mechanism the policies either reject every query or, if written permissively, silently allow everything, and the isolation test would still pass because the Prisma middleware caught the request first.

**Business value:** Guarantees tenant isolation at the storage layer, and makes the isolation test meaningful because it can be run with the middleware deliberately bypassed.

### 3.2.3 Operator Organisation and Staff Permissions

**Requirement ID:** FR-SEC-003

- The operators table is an organisation entity in its own right, and every operator reference across the schema points at it
- The operator_members table links accounts to operators and assigns the manager or staff role within that merchant
- Staff permissions are granted by the operator manager and are confined to data belonging to that operator
- One account may hold both a customer identity and an operator staff identity. The two are not mutually exclusive
- Platform-level roles are limited to customer and administrator. All merchant-scoped roles live only in operator_members, so there is one source of truth for every permission decision

**Design reason:** The original single-role enumeration could not represent a rental company with several staff accounts, and could not represent a person who is both a customer and a merchant employee. Holding merchant roles in two places would reintroduce the same class of permission bug.

**Business value:** Supports realistic multi-staff merchant operation and removes an entire category of authorisation defect.

### 3.2.4 Account Security

**Requirement ID:** FR-SEC-004

- Five consecutive failed password attempts lock the account for fifteen minutes, and unlocking requires email verification
- Password length and complexity are enforced
- Session expiry warning with an optional keep me signed in setting

**Design reason:** The current account system offers only basic password login with no brute force protection.

**Business value:** Raises the security baseline and protects both customer and merchant data.

## 3.3 Traceability and Audit

### 3.3.1 Booking Status History

**Requirement ID:** FR-TRC-001

A BookingStatusHistory record is inserted on every status change, capturing the previous status, the new status, the actor, the time and a remark. The record covers the full lifecycle from creation through to completion or cancellation.

**Design reason:** The booking table holds only the current status and overwrites it on each change, so disputes and defects cannot be traced back.

**Business value:** Full lifecycle traceability, faster fault diagnosis and clear allocation of responsibility.

### 3.3.2 Platform Audit Log

**Requirement ID:** FR-TRC-002

An AuditLog record captures every sensitive action, including forced order status changes, configuration changes, operator profile changes, refunds, credit tier overrides, promotion overrides and data deletion. Each record holds the actor, action type, target entity and identifier, the before and after values, the source IP address and a timestamp.

**Design reason:** The current system keeps no record of high-risk administrative actions, so tampering or mistakes cannot be traced.

**Business value:** Satisfies audit requirements and provides evidence for security investigation.

### 3.3.3 Notification Delivery Log

**Requirement ID:** FR-TRC-003

A NotificationLog record captures every email and in-app notification, recording the recipient, send time, delivery status, failure reason and retry count, queryable by order and by user.

**Design reason:** Without delivery records it is impossible to determine whether a missing notification failed to send, was filtered by the recipient, or went to the wrong address.

**Business value:** Faster diagnosis of delivery problems and data to improve delivery rates.

### 3.3.4 Independent Refund Records

**Requirement ID:** FR-TRC-004

A Refund record is held separately from the Payment record and captures the related payment, refund amount, reason, status, actor and processing time. A single payment may be refunded partially and more than once.

**Design reason:** Refunds currently modify the payment status directly, which cannot represent partial or repeated refunds and makes reconciliation unreliable.

**Business value:** A controlled refund process supporting partial refunds, with traceable detail.

## 3.4 Code and Dependency Cleanup

- Remove all PayPal payment code, routes and configuration while retaining the payment abstraction layer
- Remove the legacy host booking submission endpoints, test endpoints and commented-out code
- Upgrade dependencies carrying known security advisories

## 3.5 Customer Credit Risk Management (Core BNPL Differentiator)

### 3.5.1 Risk Dimensions

**Requirement ID:** FR-RISK-001

Credit data accumulates automatically from user behaviour. The tracked measures are the number of bookings completed and paid on time, the number of bookings cancelled automatically because payment expired, the number of confirmed bookings where the customer did not appear, the number of bookings cancelled by the customer, and the on-time payment rate.

### 3.5.2 Credit Tiers and Differentiated Rules

**Requirement ID:** FR-RISK-002

| Tier | Qualifying Condition | Payment Plan | Concurrent Unpaid Bookings |
| --- | --- | --- | --- |
| Normal (default for new users) | No history, or history with no negative events | Single instalment for the full amount, 24 hour deadline, no deposit | 2 |
| Trusted | Three or more successful payments and no expired bookings | Single instalment for the full amount, 36 hour deadline, priority confirmation | 5 |
| Caution | Two expired bookings accumulated | 30 percent deposit due within 12 hours, 70 percent balance due 24 hours before service start | 1 |
| High Risk | Three or more expired bookings, or one or more no-shows | BNPL suspended. Full prepayment required at booking | 0 |

### 3.5.3 Execution Logic

1. On booking submission the system reads the customer’s current credit tier
2. The concurrent exposure limit for that tier is checked before anything else, and the booking is refused if the limit is already reached
3. A payment schedule is generated according to the tier and written against the booking
4. After every terminal status change the credit profile is recomputed asynchronously and a credit event record is written
5. Downgrades apply automatically. Upgrades require additional positive history or manual review

### 3.5.4 No-show Management

**Requirement ID:** FR-RISK-003

A no-show is a confirmed booking where the customer did not appear. Because it is the most severe input into the credit model, it needs an explicit recording path, a defined financial outcome and a route of appeal.

- The booking status enumeration gains two terminal values, no_show for a fully paid booking and no_show_unpaid for a booking where a deposit was paid but the balance was not
- An operator may mark a booking as not appeared from the service start time until the end of the marking window, which is configured per operator through no_show_window_hours and defaults to 24 hours. A remark is mandatory
- A booking cannot be marked before its service start time, and cannot be marked once the window has closed. After the window closes the booking follows its normal completion path
- A no-show does not trigger a refund. Where a deposit was paid and the balance was not, the deposit is forfeited in full to the operator and the outstanding payment schedule entries are voided
- Inventory consumed by a no-show is not released, because the operator held the asset and incurred the loss
- The customer may appeal a no-show marking. An administrator reviews the appeal, and an upheld appeal reverses the credit impact without deleting the original record

The following matrix defines the outcome of every terminal case, so that booking status, settlement eligibility and credit impact can never disagree.

| Scenario | Terminal Status | Schedules | Inventory | Funds | Settlement | Credit Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Paid in full, customer absent | no_show | None | Not released | No refund | Full net settles after the appeal window closes | no_show_count +1, downgrade to High Risk |
| Deposit paid, balance unpaid, customer absent | no_show_unpaid | Voided | Not released | Deposit forfeited in full to the operator | Deposit net settles after the appeal window closes | no_show_count +1 and expired_count +1, downgrade to High Risk |
| Nothing paid, deadline passed | expired | Voided | Released | No funds held | Not settleable | expired_count +1 |
| Customer cancels before service | cancelled | Voided | Released | Refund per the applicable cancellation policy | Net of refund | cancel_count +1 |
| Service delivered | completed | All paid | Consumed | No refund | Full net amount settles | completed_count +1, counts toward upgrade |

**Design reason:** V2.1 made a no-show the most severe credit penalty but provided no way to record one. It also auto-completed the booking, which made it settleable revenue even where a balance was never paid, and left a completed booking holding open payment schedule entries. The deposit-paid-then-absent case was unclassified entirely.

**Business value:** The credit rules become executable rather than aspirational, the operator is compensated for inventory it held and lost, and settlement can never be triggered against money that was never collected.

### 3.5.5 Instalment Payment Schedules

**Requirement ID:** FR-PAY-001

- The payment_schedules table manages every due payment for every booking, replacing the previous single payment deadline and deposit fields
- A booking may carry several schedule entries, for example a deposit and a balance, each holding a sequence number, due date, amount and status
- All scheduled tasks work from the schedule due dates, so deposits, balances and any future instalment plan share one monitoring path
- When a booking reaches a terminal status the outstanding entries are voided rather than deleted, preserving the record of what was owed

**Design reason:** A single deadline column and a deposit percentage cannot express the tiered rules in 3.5.2, and adding instalments later would require reworking every job that reads the deadline.

**Business value:** Supports differentiated credit payment rules today and multi-instalment BNPL later as a configuration change, and unifies deadline monitoring into a single mechanism.

### 3.5.6 Credit Event Traceability and Appeals

**Requirement ID:** FR-RISK-004

- Every credit change writes a customer_risk_events record capturing event type, the related booking, the tier before and after, the reason, the actor and the timestamp
- Each event carries a state of active, appealed or reversed. A successful appeal writes a new reversing event that references the original rather than modifying it, so history is never rewritten
- Customers can view their own credit record and the reason for each change in the personal centre, and can raise an appeal from the same view
- Manual tier adjustment is supported and is written to both the credit event log and the audit log

**Design reason:** The credit profile alone is a snapshot with no history. A customer disputing a tier has nothing to inspect and the platform has nothing to justify its decision. The appeal path promised in the no-show requirement had no data model at all, which contradicts the traceability principle applied everywhere else in this design.

**Business value:** Credit decisions become explainable and reversible, disputes reduce, and the mechanism satisfies audit and compliance expectations.

### 3.5.7 Concurrent Exposure Limit

**Requirement ID:** FR-RISK-005

Tier rules react to accumulated history, which means they cannot respond to a burst of activity from an account with no history. A newly registered account defaults to Normal, so without an additional control it could hold a large number of unpaid bookings across several operators before any expiry has occurred and before the scoring engine has anything to react to. That is precisely the scenario the credit framework exists to prevent.

- Each tier carries a limit on the number of confirmed bookings a customer may hold that are not yet fully paid, as defined in the table in 3.5.2
- The limit is evaluated at booking creation with a single count query, inside the same transaction that decrements inventory, so that concurrent submissions cannot both pass
- A booking refused by the limit returns a clear message telling the customer to complete an existing payment first, and is not counted as a negative credit event
- The limits are held in system settings so that they can be tuned without a code change

**Design reason:** A purely reactive scoring engine has a structural blind spot at the start of an account’s life, which is exactly when abuse is cheapest.

**Business value:** Closes the opening that historical scoring cannot cover, at the cost of one indexed count query per booking.

## 3.6 Feature Flag Mechanism

**Requirement ID:** FR-REL-004

- A feature flag table supports enabling and disabling functionality by environment and by operator
- A global middleware applies the flag configuration to both API endpoints and interface elements
- All Phase 4 functionality is behind a flag, as is the review display described in 4.10

**Design reason:** Merging incomplete functionality creates demonstration risk, and long-lived branches create merge cost. Feature flags allow continuous integration while controlling exposure.

**Business value:** Reduces release risk because unfinished functionality can be switched off without reverting code, and supports staged rollout to selected operators.

