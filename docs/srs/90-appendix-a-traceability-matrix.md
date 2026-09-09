<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# Appendix A: Requirement Traceability Matrix

Requirement identifiers are assigned by module rather than by theme, so that a requirement about payment scheduling is not filed under risk. Every identifier below appears in the body of this document, and every test case identifier appears in Section 11 or is covered by the acceptance testing scope defined there.

| Requirement ID | Description | Section | Module | Test Case | Status |
| --- | --- | --- | --- | --- | --- |
| FR-REL-001 | Booking idempotency control with persistent keys | 3.1.1 | Reliability | TC-REL-001 | Not started |
| FR-REL-002 | Payment callback validation, idempotency, reconciliation and retry | 3.1.2 | Payments | TC-REL-002 | Not started |
| FR-REL-003 | Scheduled task logging, retry, daily sweep and advisory locking | 3.1.3 | Operations | TC-REL-003 | Not started |
| FR-REL-004 | Feature flag mechanism by environment and operator | 3.6 | Engineering | TC-REL-004 | Not started |
| FR-FIN-001 | Stripe Connect settlement with service-completion trigger | 3.1.4 | Finance | TC-FIN-001 | Not started |
| FR-FIN-002 | Commission formulas and promotion cost attribution | 3.1.5 | Finance | TC-FIN-002 | Not started |
| FR-SEC-001 | Layered system and operator configuration | 3.2.1 | Configuration | TC-SEC-001 | Not started |
| FR-SEC-002 | Multi-tenant row-level isolation with transaction-local context | 3.2.2 | Permissions | TC-SEC-002 | Not started |
| FR-SEC-003 | Operator organisation entity and staff permission model | 3.2.3 | Permissions | TC-SEC-003 | Not started |
| FR-SEC-004 | Account lockout, password strength and session handling | 3.2.4 | Security | TC-SEC-004 | Not started |
| FR-TRC-001 | Booking status history | 3.3.1 | Traceability | TC-TRC-001 | Not started |
| FR-TRC-002 | Platform audit log for sensitive actions | 3.3.2 | Traceability | TC-TRC-002 | Not started |
| FR-TRC-003 | Notification delivery logging | 3.3.3 | Traceability | TC-TRC-003 | Not started |
| FR-TRC-004 | Independent refund records supporting partial refunds | 3.3.4 | Finance | TC-TRC-004 | Not started |
| FR-RISK-001 | Credit risk measurement dimensions | 3.5.1 | Credit risk | TC-RISK-001 | Not started |
| FR-RISK-002 | Four credit tiers with differentiated payment plans and exposure limits | 3.5.2 | Credit risk | TC-RISK-002 | Not started |
| FR-RISK-003 | No-show marking, terminal status matrix and deposit forfeiture | 3.5.4 | Credit risk | TC-RISK-003 | Not started |
| FR-RISK-004 | Credit event history, appeal state and reversal | 3.5.6 | Credit risk | TC-RISK-004 | Not started |
| FR-RISK-005 | Concurrent unpaid booking exposure limit | 3.5.7 | Credit risk | TC-RISK-005 | Not started |
| FR-PAY-001 | Multi-instalment payment schedules replacing the single deadline | 3.5.5 | Payments | TC-PAY-001 | Not started |
| FR-LIST-001 | Listing information management for car rental and tours | 4.1.1 | Catalogue | TC-LIST-001 | Not started |
| FR-LIST-002 | Pricing rule engine with priority resolution | 4.1.2 | Catalogue | TC-LIST-002 | Not started |
| FR-LIST-003 | Add-on service configuration and pricing | 4.1.4 | Catalogue | TC-LIST-003 | Not started |
| FR-LIST-004 | Location library and listing to location association | 4.1.5 | Catalogue | TC-LIST-004 | Not started |
| FR-LIST-005 | Dual-source inventory ingestion | 4.1.6 | Catalogue | TC-LIST-005 | Not started |
| FR-INV-001 | Range-atomic daily inventory reservation and release | 4.1.3 | Inventory | TC-INV-001, TC-INV-002 | Not started |
| FR-CUST-001 | Customer home page and search entry | 4.2.1 | Customer web | TC-CUST-001 | Not started |
| FR-CUST-002 | Search and structured filtering | 4.2.2 | Customer web | TC-CUST-002 | Not started |
| FR-CUST-003 | Package detail page | 4.2.3 | Customer web | TC-CUST-003 | Not started |
| FR-CUST-004 | Booking confirmation flow | 4.2.4 | Customer web | TC-CUST-004 | Not started |
| FR-CUST-005 | Payment page with full schedule display | 4.2.5 | Customer web | TC-CUST-005 | Not started |
| FR-CUST-006 | Personal centre including credit record and appeals | 4.2.6 | Customer web | TC-CUST-006 | Not started |
| FR-OP-001 | Operator dashboard | 4.3.1 | Operator web | TC-OP-001 | Not started |
| FR-OP-002 | Order management including no-show marking | 4.3.2 | Operator web | TC-OP-002 | Not started |
| FR-OP-003 | Inventory calendar | 4.3.3 | Operator web | TC-OP-003 | Not started |
| FR-OP-004 | Pricing rule configuration interface | 4.3.4 | Operator web | TC-OP-004 | Not started |
| FR-OP-005 | Shop settings including cancellation policy | 4.3.5 | Operator web | TC-OP-005 | Not started |
| FR-OP-006 | Settlement and commission reporting | 4.3.6 | Operator web | TC-OP-006 | Not started |
| FR-OP-007 | SARIMA dynamic pricing suggestions | 4.3.7 | Analytics | TC-OP-007 | Not started |
| FR-ADM-001 | Platform overview dashboard | 4.4.1 | Admin | TC-ADM-001 | Not started |
| FR-ADM-002 | Operator lifecycle management | 4.4.2 | Admin | TC-ADM-002 | Not started |
| FR-ADM-003 | Global order control with audit | 4.4.3 | Admin | TC-ADM-003 | Not started |
| FR-ADM-004 | Credit appeal review queue and decisions | 4.4.4 | Admin | TC-ADM-004 | Not started |
| FR-ADM-005 | System settings including tier thresholds and flags | 4.4.7 | Admin | TC-ADM-005 | Not started |
| FR-MKT-001 | Campaign and promotion code management with funding rules | 4.4.5 | Marketing | TC-MKT-001 | Not started |
| FR-MKT-002 | Redemption and channel attribution reporting | 4.4.6 | Marketing | TC-MKT-002 | Not started |
| FR-MKT-003 | Content operations management (Phase 4) | 4.4.8 | Marketing | TC-MKT-003 | Not started |
| FR-CHAT-001 | Layered conversation architecture | 4.5.1 | Chatbot | TC-CHAT-001 | Not started |
| FR-CHAT-002 | Rule engine layer | 4.5.2 | Chatbot | TC-CHAT-002 | Not started |
| FR-CHAT-003 | LLM fallback with scoped context | 4.5.3 | Chatbot | TC-CHAT-003 | Not started |
| FR-CHAT-004 | Escalation and conversation persistence | 4.5.4 | Chatbot | TC-CHAT-004 | Not started |
| FR-CHAN-001 | Mobile application (Phase 4) | 4.6 | Channels | TC-CHAN-001 | Not started |
| FR-CHAN-002 | WhatsApp integration with identity linking (Phase 4) | 4.7 | Channels | TC-CHAN-002 | Not started |
| FR-LIST-006 | Bulk listing import from CSV with per-row error reporting | 4.1.7 | Catalogue | TC-LIST-006 | Not started |
| FR-ADM-006 | Pilot metrics view with per-tier breakdown and CSV export | 4.4.9 | Admin | TC-ADM-006 | Not started |
| FR-ANL-002 | Product event instrumentation supporting pilot evaluation | 9.4 | Analytics | TC-ANL-002 | Not started |
| FR-ANL-001 | Operator and platform analytics and reporting | 4.8 | Analytics | TC-ANL-001 | Not started |
| FR-COMP-001 | User consent records for PDPA | 4.9.1 | Compliance | TC-COMP-001 | Not started |
| FR-COMP-002 | Structured document management with private storage | 4.9.2 | Compliance | TC-COMP-002 | Not started |
| FR-TRUST-001 | Booking-verified reviews, phased across Phase 1, 2 and 4 | 4.10 | Trust | TC-TRUST-001 | Not started |
| FR-ARCH-001 | PostgreSQL job queue with lease, backoff and dead-letter handling | 6.3.2 | Architecture | TC-ARCH-001 | Not started |
| FR-ARCH-002 | Outbox behaviour: outbound work enqueued inside the business transaction | 6.3.3 | Architecture | TC-ARCH-002 | Not started |
| FR-ARCH-003 | Tenant context enforced by a wrapped client, lint rule and system role | 6.4.1 | Permissions | TC-SEC-002 | Not started |
| FR-ARCH-004 | Access and refresh token lifecycle with immediate account revocation | 6.4.2 | Security | TC-ARCH-004 | Not started |
| FR-ARCH-005 | WhatsApp identity verification and restricted channel scope | 6.4.3 | Security | TC-ARCH-005 | Not started |
| FR-ARCH-006 | API versioning under a /v1 prefix with a deprecation policy | 6.6.1 | Architecture | TC-ARCH-006 | Not started |
| NFR-RES-001 | Defined timeout and degradation behaviour for every external dependency | 6.5 | Resilience | TC-RES-001 | Not started |
| NFR-MAIN-005 | Unified error contract with a request identifier threaded through logs | 6.6.2 | Maintainability | TC-ARCH-007 | Not started |
| NFR-PERF-005 | No overselling under concurrency, single-day and multi-day | 7.1 | Inventory | TC-INV-001, TC-INV-002 | Not started |
| NFR-SEC-006 | Row-level tenant isolation verified with middleware bypassed | 7.2 | Permissions | TC-SEC-002 | Not started |
| NFR-SEC-007 | Identity documents in private storage with presigned access | 7.2 | Compliance | TC-COMP-002 | Not started |
| NFR-DATA-001 | UTC storage with Malaysia time deadline arithmetic | 7.8 | Platform | TC-DATA-001 | Not started |
| NFR-DATA-002 | Integer minor-unit monetary representation | 7.8 | Finance | TC-FIN-002 | Not started |

