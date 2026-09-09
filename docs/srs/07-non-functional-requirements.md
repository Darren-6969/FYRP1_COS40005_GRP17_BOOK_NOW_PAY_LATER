<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 7. Non-functional Requirements

## 7.1 Performance

| ID | Requirement |
| --- | --- |
| NFR-PERF-001 | Target first contentful paint of two seconds or less under normal network conditions |
| NFR-PERF-002 | Target API P95 response time of 500 milliseconds or less |
| NFR-PERF-003 | Scheduled task execution drift of five minutes or less from the scheduled time |
| NFR-PERF-004 | Support 100 concurrent users without material degradation |
| NFR-PERF-005 | Inventory reservation and booking creation remain correct under concurrency, with no overselling for single-day or multi-day bookings |

> These are target values, verified by load testing in the test environment as described in Section 11. Measured results are reported against the targets rather than assumed, and any target not met is reported with its actual figure rather than removed.

## 7.2 Security

| ID | Requirement |
| --- | --- |
| NFR-SEC-001 | All business endpoints require JWT authentication and role-based authorisation. Public browsing endpoints are the only exception |
| NFR-SEC-002 | Sensitive data is encrypted at rest and passwords are hashed with bcrypt |
| NFR-SEC-003 | All input is validated, with protection against SQL injection and cross-site scripting |
| NFR-SEC-004 | All endpoints are rate limited to resist brute force and scraping |
| NFR-SEC-005 | Customer data follows the PDPA minimisation principle, including data sent to the third-party language model |
| NFR-SEC-006 | Tenant data is isolated at row level in the database, using the session mechanism defined in FR-SEC-002 |
| NFR-SEC-007 | Identity documents are held in a private object storage bucket and served only through short-lived presigned URLs |

## 7.3 Usability

| ID | Requirement |
| --- | --- |
| NFR-USE-001 | The core flow of browsing, booking, paying and confirming can be completed without instructions |
| NFR-USE-002 | The web interface is responsive across common device sizes |
| NFR-USE-003 | Errors present a clear message and a route back to a working state |
| NFR-USE-004 | Core functionality degrades gracefully. If the chatbot fails, a human support entry point is shown in its place |

## 7.4 Maintainability

| ID | Requirement |
| --- | --- |
| NFR-MAIN-001 | Code follows the existing ESM module conventions and component architecture |
| NFR-MAIN-002 | Every new API endpoint is accompanied by documentation, generated from the contract defined in Phase 0 |
| NFR-MAIN-003 | Database changes are managed through Prisma migrations and tracked in version control |
| NFR-MAIN-004 | New capability is released behind a feature flag to reduce release risk |
| NFR-MAIN-005 | All endpoints return a unified error shape carrying a machine-readable code and a request identifier, as defined in 6.6.2 |

## 7.5 Resilience

| ID | Requirement |
| --- | --- |
| NFR-RES-001 | Every external dependency has a defined timeout and a defined degradation behaviour, as specified in the failure mode table in 6.5. No outbound call is made without a timeout |
| NFR-RES-002 | Background jobs survive process restart. Work in progress is reclaimed rather than lost, and handlers are idempotent so that reclaimed work does not duplicate its effect |

## 7.6 Extensibility

| ID | Requirement |
| --- | --- |
| NFR-SCAL-001 | Adding an operator requires no code change |
| NFR-SCAL-002 | Payment channels and notification channels are pluggable |
| NFR-SCAL-003 | Pricing rules, credit tier thresholds and exposure limits are configurable rather than hard-coded |

## 7.7 Observability

| ID | Requirement |
| --- | --- |
| NFR-OBS-001 | Application errors on both the front end and the back end are captured with stack traces and reported to an error tracking service |
| NFR-OBS-002 | Core business metrics are monitored, covering booking success rate, payment failure rate, callback backlog and scheduled task success rate |
| NFR-OBS-003 | Logs are structured and centrally collected, with financial and booking path logs retained permanently |

## 7.8 Data Conventions

| ID | Requirement |
| --- | --- |
| NFR-DATA-001 | All timestamps are stored as timestamptz in UTC. All deadline arithmetic, including payment due dates, the no-show marking window and daily sweeps, is performed in Asia/Kuala_Lumpur. The date column in listing_availability is a plain date interpreted in operator local time. All display is localised. Scheduled jobs are configured against Malaysia time rather than UTC, because a job scheduled at UTC midnight runs at eight in the morning locally, which is not when a daily expiry sweep should run |
| NFR-DATA-002 | All monetary values are stored as integers in the minor currency unit, that is sen, and never as floating point. The commission formulas in 3.1.5 involve rounding and a percentage multiplication, and floating point representation would introduce drift that makes the ledger fail to reconcile against Stripe |

> Neither of these conventions appeared in V2.1. Both affect correctness rather than presentation: without a stated timezone the payment deadline, the no-show window and the daily sweep can each resolve differently, and without integer money the settlement ledger cannot be reconciled exactly.

