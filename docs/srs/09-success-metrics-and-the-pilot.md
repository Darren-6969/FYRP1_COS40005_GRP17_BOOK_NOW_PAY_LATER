<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 9. Success Metrics and the Pilot

Sections 3 to 8 define what the system does and how it is built. This section defines how we will know whether it worked. Without it, the only available definition of success is that the features exist and the tests pass, which tells the client nothing and gives the final report no evaluation chapter.

**Agreed target:** by the end of week 8 the platform is live with two to three real operators taking real bookings from real customers. Weeks 9 and 10 are live pilot operation. This is a pilot, not a demonstration, and the difference drives most of this section.

## 9.1 North Star Metric

**Weekly bookings that complete and settle.**  A booking counts only once the service was delivered and the operator was paid.

Counting bookings created would be the wrong choice for this product. Under deferred payment a booking that is created and then expires unpaid has negative value, because the operator held a vehicle and received nothing. The metric would peak at exactly the moment the platform was hurting its operators most. The settled version only moves when the whole mechanism worked: found, booked, paid on time, delivered, settled.

## 9.2 Pilot Exit Criteria

Two or three operators over two weeks will not produce enough transactions for percentages to carry meaning. Twenty bookings is not a sample from which a conversion rate can be read. Success is therefore defined as completing the loop with real money, not as hitting a rate.

| # | Criterion | Target | Pass condition |
| --- | --- | --- | --- |
| 1 | Operators live and stocked | 2 to 3 | Each has 5 or more published listings with pricing and 60 days of availability |
| 2 | Real bookings created | 20 or more | Created by customers outside the project team |
| 3 | Bookings paid and completed | 15 or more | Payment collected and service delivered |
| 4 | Settlement executed | 1 or more per operator | Payout reconciles line by line against the Stripe balance report |
| 5 | Overselling incidents | Zero | No date shows negative remaining quantity and no two bookings hold the same unit |
| 6 | Unexplained ledger lines | Zero | Every commission ledger entry traces to a payment and a payout |
| 7 | Credit mechanism exercised | 1 or more of each | At least one deposit-tier booking created and one expiry handled automatically |
| 8 | Duplicate bookings or payments | Zero | Idempotency holds under real traffic |
| 9 | Operator verdict | All pilot operators | Each states they would continue using the platform |

> Criteria 5, 6 and 8 would end the pilot immediately if they failed, because each destroys operator trust in a way an apology does not repair. Criterion 9 is the only subjective measure and also the most important one.

## 9.3 Metric Hierarchy

These are collected during the pilot as a baseline for a later launch, not as results. At this volume they are observations and will be reported as such.

| Group | Metrics |
| --- | --- |
| Supply | Operators live with at least one published listing; days from approval to first listing; share of listings with availability in the next 30 days |
| Demand | Registrations by channel; search to detail rate; detail to booking rate; the step at which incomplete bookings stop |
| BNPL health | On-time payment rate; expiry rate; no-show rate; distribution across the four credit tiers; expiry rate calculated separately per tier; booking attempts refused by the exposure cap; deposit-tier bookings where the balance was also paid |
| Commercial | Gross booking value; commission revenue net of platform-funded discounts; effective take rate; average booking value; ledger entries reconciling exactly against Stripe |
| Support | Conversations resolved without escalation; rule layer versus language model answer split; time from escalation to operator reply |

> The BNPL health group is the reason this project exists and the source of its evaluation evidence. If nothing else is measured, these must be.

## 9.4 Instrumentation Requirement

**Requirement ID:** FR-ANL-002

None of section 9.3 is measurable without event capture, and measurement cannot be added retroactively. If the pilot runs without instrumentation we will have a working platform and no ability to say anything about how it performed.

- An analytics_events table records event name, user, operator, booking, a JSONB property bag and the timestamp
- Events emitted: search_performed, listing_viewed, booking_started, booking_created, exposure_blocked, payment_succeeded, payment_expired, booking_completed, no_show_marked, payout_settled, chat_escalated
- The credit tier is recorded as a property on booking_created, payment_expired and no_show_marked. Without it the per-tier comparison in 9.6 cannot be produced, and that comparison is the project’s strongest result
- Events are emitted through the job queue and never block a user request
- No personal data in the property bag. Reference identifiers only
- Emission failure is logged but never fails the business operation. Losing a metric must not lose a booking

**Design reason:** the requirements repeatedly describe outcomes the platform is meant to produce, but nothing in the system records whether they occurred. This is the same capability alignment failure the data model was corrected for in V2.1, applied to measurement rather than to features.

## 9.5 Pilot Readiness

A pilot with real bookings puts several workstreams on the critical path that are not software. They are listed here because none of them appeared in earlier versions of this document, and two of them depend on people outside the team responding.

| Because the pilot is real | This becomes necessary | Owner |
| --- | --- | --- |
| Real customers give us personal data | Published privacy policy and terms of service, reviewed before launch, with consent recorded at registration. A PDPA requirement, not a nice-to-have | Lead |
| Real money moves | Stripe activated in live mode; each operator completes identity verification and connects a bank account. Stripe controls this timeline, so it starts as soon as operators are named | Lead |
| Operators receive settlement | The commission rate must be a decided number rather than a configurable field. Operators ask before they sign up | Client decision |
| Real transactions occur | Clarity on whether the platform or the operator issues the tax invoice and what each must file. Requires a qualified adviser | Lead |
| Real customers hit problems | A named person on rota for escalations during the pilot with an agreed response target | Lead |
| Operators need listings in the system | A bulk import path. Manual entry of fifty vehicles is hours of work and the largest single reason an operator abandons onboarding. See FR-LIST-006 | Member B / Lead |
| Two to three operators must exist | Identified, approached and agreed. In practice a client relationship rather than something the project team can do cold | Client + Lead |

> Operator recruitment and Stripe verification are the two items most likely to sink the pilot, and the two the team controls least. If operators are not confirmed by the end of week 5, that is a formal project risk rather than something to absorb quietly.

## 9.6 Evaluation Plan for the Final Report

Four pieces of evidence, ordered by how convincing they are.

| Evidence | What it is | Strength |
| --- | --- | --- |
| Correctness under concurrency | The test results from 11.2: single-date oversell, multi-day overlapping oversell, deadlock, and tenant isolation with the application middleware bypassed | Strongest. Deterministic and independent of pilot volume. The multi-day case is the one worth presenting in detail, because a naive per-date implementation passes the single-date test and fails it |
| Credit tier effectiveness | Expiry rate for Normal-tier against Caution-tier bookings with counts stated, exposure-cap refusals, deposit recovery rate, and tier distribution at pilot close | The central claim of the project. Pilot volume will not support a statistical result and none will be claimed. Present as a descriptive comparison with the sample size stated |
| Usability evaluation | System Usability Scale with pilot operators and supervised customer sessions; task completion rate and time for four core tasks | Moderate. Small sample, but the observations of where participants hesitated are useful regardless |
| Operator interviews | A structured interview with each pilot operator: whether they would continue, what they would change, and whether the credit mechanism changed how they felt about deferred payment | For a pilot this size, three honest interviews carry more weight than any percentage we could compute |

> Overstating a result from twenty bookings is a worse outcome in a viva than reporting a small one accurately. The honest framing is part of the evidence.

## 9.7 Review Cadence

| Cadence | When | What is reviewed | Output |
| --- | --- | --- | --- |
| Weekly build check | Mondays from week 2 | Backlog burndown against the schedule, blockers, owner load variance | Reallocation or escalation |
| Week 4 checkpoint | End of week 4 | Whether the core backend is complete, and whether the schedule still holds | A scope decision, made in the meeting rather than deferred |
| Pilot weekly review | Weeks 9 and 10 | Exit criteria progress, BNPL health metrics, incidents, support load | Actions for the week and any configuration changes |
| Pilot close | End of week 10 | All exit criteria, all four evidence sets, operator interviews | Pilot verdict and the evaluation chapter |

The pilot weekly review runs from the metrics view described in FR-ADM-006, so it takes minutes rather than requiring anyone to write queries. If preparing the review is difficult it will stop happening in the week it matters most.

