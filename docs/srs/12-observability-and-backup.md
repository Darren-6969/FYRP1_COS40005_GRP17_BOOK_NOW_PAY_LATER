<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 12. Observability and Backup

## 12.1 Monitoring and Error Tracking

- Sentry or an equivalent service captures front-end and back-end exceptions with stack traces, with alert rules configured for error rate spikes
- DigitalOcean native monitoring covers database CPU and connection count, application memory and response time, and error rate
- Business metric monitoring covers booking success rate, payment failure rate, callback processing backlog and scheduled task success rate

> Vercel provided log access and error surfacing as part of the platform. That is not carried over by the migration, so observability becomes something the team configures rather than something it inherits. This is listed as a requirement rather than an operational nicety.

## 12.2 Log Management

- Structured application logging with centralised collection
- Key business operation logs retained for at least 30 days
- Payment, booking and settlement path logs retained permanently

## 12.3 Backup and Recovery

- DigitalOcean Managed PostgreSQL daily automated backups retained for seven days, with weekly full backups retained for 30 days
- Point-in-time recovery enabled, giving a recovery point objective of under one hour for transactional data
- Recovery time objective of four hours or less
- Backup restoration is verified once per term as part of the migration rehearsal, so that the backup is known to be usable rather than assumed to be
- For payment records specifically, webhook_events provides a second recovery path: Stripe events can be replayed to rebuild payment state independently of the database backup

> A 24 hour recovery point objective, as stated in V2.1, would mean up to a full day of payment records lost against a Stripe ledger that would still hold them. That gap cannot be reconciled by hand, which is why point-in-time recovery and callback replay are both specified.

