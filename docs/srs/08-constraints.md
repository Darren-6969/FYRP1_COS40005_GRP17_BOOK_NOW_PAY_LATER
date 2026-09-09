<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 8. Constraints

## 8.1 Technical Constraints

- Development remains within the existing technology stack. No new stack is introduced
- Deployment is on DigitalOcean App Platform with no GPU resource, so the language model must be a third-party API
- Database changes must be incremental and must not destroy historical data
- All file storage uses DigitalOcean Spaces, with separate buckets and access policies for public listing images and private identity documents

### 8.1.1 Platform Migration Constraints

Moving from Vercel to DigitalOcean removes three platform services that the current system relies on. Each needs an explicit replacement, and each is a source of defects that would otherwise appear late.

- Scheduling. Vercel Cron is not available. Scheduled jobs run either as a dedicated worker component or inside the service, and in either case acquire a PostgreSQL advisory lock before executing, so that a job cannot run twice if more than one instance is active. Without this, expiry sweeps would cancel bookings twice and send duplicate notifications
- Real-time connections. Socket.IO requires either a single service instance or a Redis adapter with sticky sessions. Given the expected scale the service is pinned to a single instance for this project, and the constraint is recorded so that it is revisited before scaling
- Connection pooling. Managed PostgreSQL enforces a connection limit. Prisma connects through the DigitalOcean connection pool in transaction mode, which is also why the row-level security context in FR-SEC-002 must be set transaction-locally rather than at session level
- Deployment topology. The React build and the Node service are deployed as two components of one App Platform application under a single domain, which keeps requests same-origin and avoids cross-origin cookie and CORS handling
- Rollback. The existing Vercel deployment is frozen at the last known good commit and retained as a rollback target and demonstration backup until the DigitalOcean environment passes user acceptance testing, after which it is decommissioned. It is not part of the production topology

## 8.2 External Dependency Constraints

- WhatsApp Business API depends on Meta account review and template approval, on a timeline outside the team’s control
- The availability, pricing and terms of Stripe, the Claude API and other third-party services are outside the project’s control
- A production DuitNow account requires a registered Malaysian business entity, which the project team does not hold. DuitNow is therefore supported through manual receipt verification only, and Stripe remains the primary automated channel

## 8.3 Regulatory Constraints

- The platform must comply with the Malaysia Personal Data Protection Act 2010
- Consent records must be traceable and available for compliance audit
- Data transferred to the third-party language model must be minimised and must not include identity document content
- On account closure the platform pseudonymises identifying fields, specifically name, phone, email and address, while retaining booking references, amounts, invoices, the commission ledger and audit records for the statutory retention period. The reasoning for this split is recorded as ADR-10

## 8.4 Project Resource Constraints

- The development window is 31 August to 8 November 2026, which is ten weeks. Weeks 1 to 8 are committed development ending in pilot go-live; weeks 9 and 10 are live pilot operation with optional extension work alongside
- The team consists of four members and a lead, all carrying other units at the same time. The plan assumes roughly 58 percent of a working week per member
- Third-party service budget is limited, favouring free tiers and trial allowances

