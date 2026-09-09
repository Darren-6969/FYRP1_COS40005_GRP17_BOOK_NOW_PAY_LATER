# Success Metrics and Evaluation Framework

# 1. Why This Document Exists

The SRS defines what the system does. It contains performance targets such as response time, which are engineering measures. It contains no product measures at all, which means that as written there is no definition of success for the platform other than the features existing and the tests passing.

This matters for two separate reasons. Commercially, the client cannot tell whether the pilot worked. Academically, the final report needs an evaluation chapter, and "we built what we specified" is a weak one. The strongest claim this project can make is about the credit tiering mechanism, and that claim requires evidence.

> Measurement cannot be added retroactively. If the pilot runs without event instrumentation, we will have a working platform and no ability to say anything about how it performed. This is why story BNPL-074 is a Phase 1 item rather than something left until the report is written.

# 2. North Star Metric

**Weekly bookings that complete and settle.**  A booking counts only when the service was delivered and the operator was paid.

The obvious alternative, bookings created, is the wrong choice for this product. Under a deferred payment model a booking that is created and then expires unpaid has negative value: the operator held a vehicle and received nothing. Counting created bookings would make the platform look most successful at exactly the moment it was hurting its operators most.

Choosing the settled version means the metric only moves when the entire mechanism worked: the customer found something, booked it, paid within the deadline, used the service, and the operator received money. That is the product working, stated as one number.

# 3. Pilot Exit Criteria

Two or three operators over roughly three weeks will not generate enough transactions for rates and percentages to carry meaning. Twenty bookings is not a sample from which a conversion rate can be read, and reporting one as though it were would be misleading. Pilot success is therefore defined as completing the loop, not as hitting a rate.

| # | Criterion | Target | Pass condition |
| --- | --- | --- | --- |
| 1 | Operators live and stocked | 2 to 3 operators | Each has 5 or more published listings with pricing and 60 days of availability |
| 2 | Real bookings created | 20 or more | Created by customers outside the project team |
| 3 | Bookings paid and completed | 15 or more | Payment collected and service delivered |
| 4 | Settlement executed | 1 or more payout per operator | Payout reconciles line by line against the Stripe balance report |
| 5 | Overselling incidents | Zero | No date shows negative remaining quantity and no two bookings hold the same unit |
| 6 | Unexplained ledger lines | Zero | Every commission ledger entry traces to a payment and a payout |
| 7 | Credit mechanism exercised | 1 or more of each | At least one deposit-tier booking created and at least one expiry handled automatically |
| 8 | Duplicate bookings or payments | Zero | Idempotency holds under real traffic |
| 9 | Operator verdict | All pilot operators | Each states they would continue using the platform |

Criteria 5, 6 and 8 are the ones that would end the pilot immediately if they failed, because each destroys operator trust in a way that an apology does not repair. Criterion 9 is the only subjective measure and it is also the most important one.

# 4. Metric Hierarchy

These are the measures we collect during the pilot. At pilot volume they are observations that establish a baseline for a later launch, not results. We will present them with that caveat rather than dressing small numbers up as findings.

## 4.1 Supply Side

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Operators live | Approved operators with at least one published listing and availability | Approving an operator who never lists is not supply. This is the honest count |
| Time to first listing | Days from approval to first published listing | Directly measures the onboarding barrier. If this is long, bulk import is the fix |
| Listing coverage | Listings with availability in the next 30 days, as a share of published listings | A listing with no availability is invisible to search and produces nothing |

## 4.2 Demand Side

| Metric | Definition | Why it matters |
| --- | --- | --- |
| New registrations | Accounts created, split by channel | Tests whether the multi-channel approach produced anything |
| Search to detail rate | Searches producing at least one listing view | A low rate suggests supply does not match what people search for |
| Detail to booking rate | Listing views producing a booking | The main conversion step, and where reviews and trust signals would show their effect |
| Booking abandonment point | Step at which incomplete bookings stop | Identifies the single highest-value fix in the flow |

## 4.3 BNPL Health

This group is the reason the project exists and the source of its evaluation evidence. If nothing else is measured, these must be.

| Metric | Definition | Why it matters |
| --- | --- | --- |
| On-time payment rate | Bookings paid in full by the deadline, over bookings confirmed | The headline test of whether deferred payment works here |
| Expiry rate | Bookings cancelled automatically for non-payment, over bookings created | The cost the model imposes on operators. The number they care about most |
| No-show rate | Bookings marked not appeared, over bookings paid | The residual loss the credit system cannot prevent |
| Tier distribution | Share of customers in each of the four credit tiers | Shows whether tiering is doing anything or everyone sits in Normal |
| Expiry rate by tier | Expiry rate calculated separately for each tier | The comparison the whole project rests on. See section 6 |
| Exposure blocks | Booking attempts refused by the concurrent limit | Direct evidence that the abuse control activated |
| Deposit conversion | Deposit-tier bookings where the balance was also paid | Tests whether the deposit mechanism actually recovers risky customers |

## 4.4 Commercial

| Metric | Definition | Why it matters |
| --- | --- | --- |
| GMV | Total value of completed bookings | The size of what flows through the platform |
| Commission revenue | Platform fee earned, net of platform-funded discounts | What the platform actually keeps |
| Effective take rate | Commission revenue over GMV | Diverges from the headline rate whenever the platform funds a promotion |
| Average booking value | GMV over completed bookings | Needed to reason about whether the commission covers the cost of running the platform |
| Settlement accuracy | Ledger entries reconciling exactly against Stripe | Must be 100 percent. Anything else is a defect, not a metric |

## 4.5 Support

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Chatbot resolution rate | Conversations closed without escalation to a person | Justifies the cost and effort of the chatbot |
| Rule versus AI split | Answers from the rule layer versus the language model | Every rule-layer answer is a saved API call. Informs whether more rules are worth writing |
| Escalation response time | Time from escalation to operator reply | The pilot support commitment, measured rather than assumed |

# 5. Instrumentation Required

None of section 4 is measurable without event capture, and the schema in SRS V2.3 has no table for it. This section defines the minimum needed. It is delivered as backlog stories BNPL-074 and BNPL-075.

## 5.1 Event Table

```
analytics_events
  id            (PK)
  event_name    text        -- see list below
  user_id       (FK, null)  -- null for anonymous searches
  operator_id   (FK, null)
  booking_id    (FK, null)
  properties    jsonb       -- credit_tier, channel, filters, amounts
  occurred_at   timestamptz
  INDEX (event_name, occurred_at), INDEX (operator_id, occurred_at)
```

## 5.2 Events to Emit

| Event | Key properties | Feeds |
| --- | --- | --- |
| search_performed | filters used, result count, channel | Search to detail rate, supply and demand match |
| listing_viewed | listing, operator, source | Detail to booking rate |
| booking_started | listing, dates, party size | Abandonment point |
| booking_created | credit_tier, schedule shape, amounts, channel, utm | Almost everything. The tier property is essential |
| exposure_blocked | credit_tier, current open bookings | Exposure blocks |
| payment_succeeded | schedule sequence, on time or late, method | On-time payment rate |
| payment_expired | credit_tier, amount forfeited | Expiry rate by tier |
| booking_completed | amounts, operator | North Star |
| no_show_marked | credit_tier, paid or unpaid, operator | No-show rate |
| payout_settled | operator, amount, booking count | Settlement accuracy |
| chat_escalated | reason, resolved by rules or model first | Chatbot resolution rate |

> Recording credit_tier on booking_created, payment_expired and no_show_marked is the single most important instrumentation decision in this document. Without it the tier comparison in section 6 cannot be produced, and that comparison is the project’s strongest evaluation result.

## 5.3 Delivery Rules

- Events are emitted through the job queue and never block a user request
- No personal data in properties. Reference identifiers only
- Emission failure is logged but never fails the business operation. Losing a metric must not lose a booking

# 6. Evaluation Plan for the Final Report

Four pieces of evidence, in the order of how convincing they are.

## 6.1 Credit Tier Effectiveness

The central claim of the project is that credit tiering reduces the cost of deferred payment to operators. The evidence is a comparison of expiry rate between tiers over the pilot period, plus the count of bookings refused by the exposure cap.

**Honest framing:** pilot volume will not support a statistical claim, and we will not make one. The correct presentation is a descriptive comparison with the sample size stated, alongside a clear statement of what a larger dataset would be needed to establish. Overstating a result from twenty bookings is a worse outcome in a viva than stating a small one accurately.

- Expiry rate for Normal-tier bookings against Caution-tier bookings, with counts not just percentages
- Number of booking attempts refused by the exposure cap, and what those customers did next
- Deposit-tier bookings where the balance was subsequently paid
- Distribution of customers across the four tiers at the end of the pilot

## 6.2 Concurrency and Correctness Evidence

This is the strongest evidence in the report because it is deterministic and does not depend on pilot volume. The test scripts and their results from SRS V2.3 section 10.2 are report artefacts, not just internal quality gates.

- Single-date test: 50 concurrent bookings against one unit produce exactly one success
- Multi-day test: two overlapping five-day bookings against one unit produce exactly one success, with no partial reservation on any date
- Deadlock test: 30 concurrent overlapping bookings complete without deadlock
- Isolation test: cross-tenant query returns zero rows with the application middleware bypassed

> The multi-day test is the one worth presenting in detail, because a naive per-date implementation passes the single-date test and fails this one. Showing that you knew the difference is the point.

## 6.3 Usability Evaluation

- System Usability Scale administered to pilot operators and to customers recruited for a supervised session
- Task completion rate and time for four tasks: find and book a car, pay a deposit, an operator publishing a listing, an operator marking a no-show
- Recorded observations of where participants hesitated or made errors

## 6.4 Operator Interviews

A short structured interview with each pilot operator at the end. Whether they would continue, what they would change, and specifically whether the credit mechanism changed how they felt about accepting deferred payment. For a pilot of this size, three honest interviews carry more weight than any percentage we could compute.

# 7. Review Cadence

| Cadence | When | Who | What is reviewed | Output |
| --- | --- | --- | --- | --- |
| Weekly build check | Every Monday from week 2 | Full team | Backlog burndown against the phase plan, blockers, owner variance | Reallocation or an escalation |
| Week 4 checkpoint | End of week 4 | Full team plus supervisor | Whether the core backend is complete, and the effort gap in the Product Brief section 8 | A decision on scope. Pre-agreed cut is the chatbot backend |
| Pilot weekly review | Weekly during weeks 6 to 8 | Team plus client | Exit criteria progress, BNPL health metrics, incidents and support load | Actions for the coming week and any configuration changes |
| Pilot close | End of week 8 | Team plus client plus supervisor | All exit criteria, all four evidence sets, operator interviews | Pilot verdict and the evaluation chapter of the report |

The pilot weekly review runs from the metrics screen in the administration console, story BNPL-075, so it takes minutes rather than requiring anyone to write queries. If preparing the review is difficult, it will stop happening in the week it is most needed.

