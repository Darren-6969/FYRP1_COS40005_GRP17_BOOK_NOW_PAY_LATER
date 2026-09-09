<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 11. Test Strategy

## 11.1 Test Layers

| Type | Scope | Phase |
| --- | --- | --- |
| Unit | Core business logic, pricing calculation, commission formulas, credit scoring, utility functions | Alongside Phase 1 and 2 development |
| Integration | API endpoints, third-party integration, database constraints | Phase 2 integration |
| Concurrency | Inventory reservation, booking creation, payment callbacks, exposure limits | Phase 3 |
| Migration verification | Full refactor migration against a production-sized snapshot | Phase 0 rehearsal, Phase 3 execution |
| Performance | API response time, page load, concurrent load | Phase 3 |
| User acceptance | Full business flows, role permissions, exception paths | Phase 3 |
| Architecture conformance | Module boundary violations, raw client imports, job idempotency, degradation behaviour | Continuous, enforced in CI |

## 11.2 Core Verification Scenarios

### 11.2.1 Single-day Oversell

- Objective: verify that the atomic decrement prevents overselling on a single date
- Method: create a listing with one remaining unit on one date, then fire 50 concurrent booking requests from a script
- Acceptance: exactly one booking is created, 49 return an insufficient inventory error, remaining quantity is zero and never negative

### 11.2.2 Multi-day Overlapping Oversell

- Objective: verify that a multi-day reservation is all-or-nothing across its full date range, which the single-row test cannot demonstrate
- Method: create a listing with one unit available on each of five consecutive dates. Fire two concurrent bookings, one covering days one to five and one covering days three to seven, so that they overlap on days three to five
- Acceptance: exactly one booking succeeds. The other is rejected in full and leaves no partial reservation on any date. No date shows a negative remaining quantity, and the rejected booking holds no inventory
- A third case runs the same overlap 30 times concurrently to confirm that no deadlock occurs, which is the reason the reservation is expressed as a single ranged statement rather than a loop over dates

> This scenario is the reason 9.2.1 alone is insufficient. A naive per-date loop passes the single-day test and fails here, and a multi-day product is the platform’s primary car rental use case. The evidence from this test is the core technical verification material for the project defence.

### 11.2.3 Payment Idempotency

- Objective: verify that repeated callbacks and repeated submissions do not create duplicate payments or bookings
- Method: deliver the same payment callback ten times and submit the same idempotency key five times
- Acceptance: one valid payment record and one valid booking, with the repeated callbacks recorded in webhook_events and marked as already processed

### 11.2.4 Multi-tenant Isolation

- Objective: verify that cross-operator data access is refused by the database, not only by application code
- Method: run two cases. First, use operator A’s account through the API to request operator B’s booking data. Second, connect directly to the database with the Prisma middleware bypassed, set the tenant context to operator A, and query operator B’s rows
- Acceptance: the API returns 403. The direct query returns zero rows. A query with no tenant context set also returns zero rows rather than all rows

> Testing only through the API would verify the Prisma middleware twice and would not exercise row-level security at all. The second case is what makes NFR-SEC-006 a verified claim rather than an assertion.

### 11.2.5 Credit Tier and Exposure Limit

- Objective: verify that tier rules generate the correct payment schedule and that the exposure limit holds under concurrency
- Method: place a Caution tier customer through a booking and confirm a two-entry schedule with the correct amounts and due dates. Separately, have a Normal tier customer with a limit of two open unpaid bookings submit three bookings concurrently
- Acceptance: the Caution booking produces a 30 percent deposit due in 12 hours and a 70 percent balance due 24 hours before service start. Exactly two of the three concurrent bookings are accepted and the third is refused by the exposure limit without recording a negative credit event

### 11.2.6 No-show Outcome Correctness

- Objective: verify that each terminal case in the matrix in 3.5.4 produces the correct status, schedule state, inventory result and settlement eligibility
- Method: construct one booking for each row of the matrix and drive it to its terminal state
- Acceptance: a no_show_unpaid booking never becomes settleable for the unpaid balance, its outstanding schedule entries are voided rather than left pending, its inventory is not released, and its deposit appears in the commission ledger as settleable after the appeal window closes

### 11.2.7 Migration Verification

- Objective: verify that the refactor migration preserves all historical data, which is the highest ranked risk in Section 13
- Method: restore a production-sized snapshot into a test environment and run the full migration. Record row counts per table before and after, verify referential integrity after constraints are applied, and time the complete run
- Acceptance: no unexplained row count change, no orphaned records, and a recorded execution time that establishes the required cutover window. Bookings whose service dates cannot be parsed from booking_details are counted and listed for manual review, and that count is a release gate

### 11.2.8 Job Queue Reliability

- Objective: verify that background work survives a process restart and that reclaimed jobs do not duplicate their effect
- Method: enqueue 50 notification jobs, kill the worker mid-run, restart it and let the leases expire. Separately, force one handler to fail five times
- Acceptance: every job reaches completed exactly once with no duplicate notification_logs entry; the repeatedly failing job reaches failed and appears in the administrator queue rather than being retried indefinitely

### 11.2.9 Architecture Conformance

- Objective: verify that the boundary rules in 6.2.2 hold in the delivered code rather than only in the document
- Method: a CI script scans each module for Prisma model access outside its owned table list, and the lint rule checks for raw client imports outside the allowlist
- Acceptance: zero cross-module table accesses and zero unapproved raw client imports. Violations fail the build rather than producing a warning

> This test is cheap to write and is what prevents 6.2.2 from becoming an aspiration by week 4. A boundary rule with no automated check is a rule that erodes quietly under deadline pressure.

### 11.2.10 Instrumentation Completeness

- Objective: verify that every event listed in FR-ANL-002 is actually emitted, before the pilot rather than after
- Method: drive one booking through every terminal path in the 3.5.4 matrix and assert the expected analytics_events rows exist with the credit tier property populated
- Acceptance: every event in the list appears at least once, no event carries personal data in its property bag, and a deliberately failed emission does not fail the booking

> This test exists because instrumentation cannot be added retroactively. A missing event discovered in week 10 means that measure is simply absent from the report.

## 11.3 Test Data and Accounts

- Three categories of test account: one platform administrator, two test operators each with a manager and a staff account, and ten test customers seeded across all four credit tiers
- Seeded listing data: five car rental packages and five tour packages with complete inventory, pricing rules, locations and add-ons
- Payment sandbox: Stripe test keys, Stripe Connect test accounts for both operators, and simulated DuitNow callbacks
- A seeded booking history sufficient to exercise the credit tier transitions and to give the SARIMA module input data

