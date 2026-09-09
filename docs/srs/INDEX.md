# SRS Index

The full specification, split by section. Read the file you need rather than all of them.

## Sections

| File | Section |
| --- | --- |
| `docs/srs/00-revision-note.md` | Revision Note |
| `docs/srs/01-introduction.md` | 1. Introduction |
| `docs/srs/02-overall-system-description.md` | 2. Overall System Description |
| `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` | 3. Optimisation of the Existing BNPL System (Phase 1, Mandatory) |
| `docs/srs/04-phase-2-platform-requirements.md` | 4. Phase 2 Platform Requirements |
| `docs/srs/05-database-architecture.md` | 5. Database Architecture |
| `docs/srs/06-system-architecture.md` | 6. System Architecture |
| `docs/srs/07-non-functional-requirements.md` | 7. Non-functional Requirements |
| `docs/srs/08-constraints.md` | 8. Constraints |
| `docs/srs/09-success-metrics-and-the-pilot.md` | 9. Success Metrics and the Pilot |
| `docs/srs/10-development-plan.md` | 10. Development Plan |
| `docs/srs/11-test-strategy.md` | 11. Test Strategy |
| `docs/srs/12-observability-and-backup.md` | 12. Observability and Backup |
| `docs/srs/13-risk-management.md` | 13. Risk Management |
| `docs/srs/14-future-scope.md` | 14. Future Scope |
| `docs/srs/90-appendix-a-traceability-matrix.md` | Appendix A: Requirement Traceability Matrix |
| `docs/srs/91-appendix-b-reference-documents.md` | Appendix B: Reference Documents |

## Requirement lookup

Every requirement ID, where it is specified, and which file to open.

| Requirement | Section | File |
| --- | --- | --- |
| `FR-ADM-001` | 4.4.1 Platform Overview Dashboard | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ADM-002` | 4.4.2 Operator Lifecycle Management | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ADM-003` | 4.4.3 Global Order Control | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ADM-004` | 4.4.4 Credit Appeal Review | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ADM-005` | 4.4.7 System Settings Centre | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ADM-006` | 4.4.9 Pilot Metrics View | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ANL-001` | 4.8 Analytics and Reporting | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-ANL-002` | 9.4 Instrumentation Requirement | `docs/srs/09-success-metrics-and-the-pilot.md` |
| `FR-ARCH-001` | 6.3.2 Asynchronous Path | `docs/srs/06-system-architecture.md` |
| `FR-ARCH-002` | 6.3.3 Outbox Behaviour | `docs/srs/06-system-architecture.md` |
| `FR-ARCH-003` | 6.4.1 Enforcing Row-Level Security | `docs/srs/06-system-architecture.md` |
| `FR-ARCH-004` | 6.4.2 Authentication and Session Lifecycle | `docs/srs/06-system-architecture.md` |
| `FR-ARCH-005` | 6.4.3 WhatsApp Channel Authentication | `docs/srs/06-system-architecture.md` |
| `FR-ARCH-006` | 6.6.1 Versioning | `docs/srs/06-system-architecture.md` |
| `FR-CHAN-001` | 4.6 Mobile Application (Phase 4) | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CHAN-002` | 4.7 WhatsApp Business Integration (Phase 4) | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CHAT-001` | 4.5.1 Layered Conversation Architecture | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CHAT-002` | 4.5.2 Rule Engine Layer | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CHAT-003` | 4.5.3 LLM Fallback | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CHAT-004` | 4.5.4 Escalation and Conversation Persistence | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-COMP-001` | 4.9.1 Consent Records | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-COMP-002` | 4.9.2 Structured Document Management | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-001` | 4.2.1 Home Page | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-002` | 4.2.2 Search and Filtering | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-003` | 4.2.3 Package Detail Page | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-004` | 4.2.4 Booking Confirmation Flow | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-005` | 4.2.5 Payment and Result | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-CUST-006` | 4.2.6 Personal Centre | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-FIN-001` | 3.1.4 Settlement and Commission (Stripe Connect Retained and Enhanced) | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-FIN-002` | 3.1.5 Commission Calculation and Promotion Cost Attribution | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-INV-001` | 4.1.3 Inventory Management and Availability | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-001` | 4.1.1 Package Information Management | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-002` | 4.1.2 Pricing Rule Engine | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-003` | 4.1.4 Add-on Services | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-004` | 4.1.5 Location Management | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-005` | 4.1.6 Dual-source Inventory Ingestion | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-LIST-006` | 4.1.7 Bulk Listing Import | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-MKT-001` | 4.4.5 Marketing Campaign Management | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-MKT-002` | 4.4.6 Attribution Reporting | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-MKT-003` | 4.4.8 Content Operations (Phase 4) | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-001` | 4.3.1 Operations Dashboard | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-002` | 4.3.2 Order Management Centre | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-003` | 4.3.3 Inventory Calendar | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-004` | 4.3.4 Pricing Rule Configuration | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-005` | 4.3.5 Shop Settings | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-006` | 4.3.6 Settlement and Commission Reports | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-OP-007` | 4.3.7 SARIMA Dynamic Pricing Suggestions | `docs/srs/04-phase-2-platform-requirements.md` |
| `FR-PAY-001` | 3.5.5 Instalment Payment Schedules | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-REL-001` | 3.1.1 Booking Idempotency Control | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-REL-002` | 3.1.2 Payment Callback Closure and Retry | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-REL-003` | 3.1.3 Scheduled Task Fault Tolerance and Monitoring | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-REL-004` | 3.6 Feature Flag Mechanism | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-RISK-001` | 3.5.1 Risk Dimensions | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-RISK-002` | 3.5.2 Credit Tiers and Differentiated Rules | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-RISK-003` | 3.5.4 No-show Management | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-RISK-004` | 3.5.6 Credit Event Traceability and Appeals | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-RISK-005` | 3.5.7 Concurrent Exposure Limit | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-SEC-001` | 3.2.1 Layered Configuration | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-SEC-002` | 3.2.2 Multi-tenant Data Isolation | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-SEC-003` | 3.2.3 Operator Organisation and Staff Permissions | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-SEC-004` | 3.2.4 Account Security | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-TRC-001` | 3.3.1 Booking Status History | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-TRC-002` | 3.3.2 Platform Audit Log | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-TRC-003` | 3.3.3 Notification Delivery Log | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-TRC-004` | 3.3.4 Independent Refund Records | `docs/srs/03-optimisation-of-the-existing-bnpl-system-phase-1.md` |
| `FR-TRUST-001` | 4.10 Review and Trust System | `docs/srs/04-phase-2-platform-requirements.md` |
| `NFR-MAIN-005` | 6.6.2 Error Contract | `docs/srs/06-system-architecture.md` |
| `NFR-RES-001` | 6.5 Resilience and Degradation | `docs/srs/06-system-architecture.md` |
