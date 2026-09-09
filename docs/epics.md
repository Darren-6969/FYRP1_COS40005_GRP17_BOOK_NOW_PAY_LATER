# Epics

| Key | Name | Phase | Owner | Scope |
| --- | --- | --- | --- | --- |
| E01 | Foundations and Environment | P0 | A / D | DigitalOcean environment, CI, API contract, module skeleton, feature flags, job queue |
| E02 | Database Refactor and Migration | P0 | A | Schema V2.3, incremental migration, service date backfill, rehearsal |
| E03 | Reliability and Payments Infrastructure | P1 | A | Idempotency, webhook handling, reconciliation, cron safety, audit, error contract |
| E04 | Identity and Access | P1 | A | Operator organisations, staff roles, token lifecycle, row-level isolation |
| E05 | Settlement and Commission | P1 | A / D | Stripe Connect, commission ledger, payouts, operator reporting |
| E06 | Credit Risk and BNPL Rules | P1 | C | Tiering, payment schedules, exposure cap, no-show, appeals, expiry sweep |
| E07 | Listing Catalogue | P1 | B | Listings, images, pricing rules, add-ons, locations, search, cancellation policy |
| E08 | Inventory Engine | P1 | B | Daily availability, range-atomic reservation and release, horizon generation |
| E09 | Booking and Orders | P1 | C | Booking orchestration, status lifecycle, cancellation, promotions, attribution |
| E10 | Chatbot | P1 | D | Rule engine, LLM fallback with circuit breaker, escalation and persistence |
| E11 | Customer Web | P2 | B | Home, search, detail, booking, payment, personal centre, authentication |
| E12 | Operator Web | P2 | C | Dashboard, orders, listings, inventory calendar, pricing, settings, settlement |
| E13 | Admin Web | P2 | D | Overview, operator lifecycle, order control, appeals, promotions, settings |
| E14 | Observability and Product Metrics | P1 | D | Error tracking, structured logs, event instrumentation, pilot metrics view |
| E15 | Pilot Readiness | P3 | Darren | Legal, operator onboarding, live payments, tax, support, go-live. Mostly non-engineering |
| E16 | Phase 4 Extensions | P4 | Various | Reviews, favourites, mobile, WhatsApp, SARIMA pricing, content operations |
