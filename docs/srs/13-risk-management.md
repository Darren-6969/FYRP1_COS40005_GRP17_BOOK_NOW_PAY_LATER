<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 13. Risk Management

| Type | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Technical | Database refactor causes loss or corruption of historical data | Low | High | Full backup, rehearsal against a production-sized snapshot, incremental migration, row count verification, limited traffic validation, retained rollback |
| Technical | Service date backfill cannot parse historical booking_details records | Medium | Medium | Unparseable records written to an exception table for manual review rather than given a guessed value; the count is a release gate |
| Technical | DigitalOcean migration hits environment incompatibility, particularly scheduling and real-time connections | Medium | Medium | Staging environment built early, advisory locks on scheduled jobs, single instance for Socket.IO, Vercel retained as rollback |
| Technical | Overselling under concurrency, particularly on multi-day bookings | Low | High | Range-atomic decrement with row count assertion, database check constraint on remaining quantity, dedicated multi-day concurrency test |
| Project | Insufficient capacity, required utilisation of 67 percent leaves no buffer | Medium | High | Week 4 checkpoint with a pre-agreed deferral of the chatbot backend to Phase 4; feature flags allow incomplete work to ship switched off |
| Project | Critical path concentrated on Member A in week 1 | Medium | High | Migration rehearsed in advance so the week 1 refactor is execution rather than discovery; API contract published early so others are not blocked |
| Project | Mobile development effort underestimated | High | Medium | Customer core functionality prioritised, dropped entirely if time runs short |
| Business | WhatsApp Meta review takes too long | Medium | Medium | Placed in Phase 4, web and email as the guaranteed channels, no core demonstration depends on it |
| Business | Malicious users occupy inventory across multiple operators | Medium | High | Credit tiering, differentiated deposits and deadlines, concurrent exposure limits, forced prepayment at high risk |
| Business | SARIMA has insufficient history on a newly launched platform | High | Low | Module shows as awaiting data below a minimum history threshold; Phase 1 middleware history used to seed where available |
| Financial | Settlement data errors cause reconciliation failure | Low | High | Explicit commission formulas, rate and funding snapshot on each ledger entry, separate processing fee column, integer money representation, line-by-line reconciliation against Stripe |
| Financial | Platform-funded promotions produce negative margin unnoticed | Medium | Medium | Discount capped at the platform commission unless explicitly overridden, projected margin shown at campaign creation, override written to the audit log |
| Compliance | PDPA position lacks supporting evidence | Low | Medium | Full consent records, data minimisation, identity documents in a private bucket with presigned access, language model input redacted |

