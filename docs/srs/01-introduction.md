<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 1. Introduction

## 1.1 Purpose

This document is the complete software requirements specification for the optimisation of the existing Book Now Pay Later platform and its transition into a standalone booking platform. It covers reliability, data architecture and credit risk improvements to the current system, together with the full functional requirements, non-functional requirements, database design, development plan and risk management for the Phase 2 car rental and tour package platform.

This document is the formal basis for development, testing, acceptance and team allocation. All development work is expected to follow the scope and requirements defined here.

## 1.2 Project Background

Phase 1 of the BNPL platform was an API-first middleware system that integrated with external host booking websites. It delivered the core booking lifecycle, a multi-tenant role-based access control model, Stripe Connect split payments, Stripe and DuitNow payment integration, Socket.IO real-time notifications, email notifications and SARIMA demand forecasting.

Following the FYP Showcase, the client Quest Marketing requested a change of direction. The platform moves from being middleware to being a standalone one-stop booking platform, where customers browse, select, book and pay directly on the platform. At the same time the existing system has gaps in transaction reliability, credit risk control, data traceability and architectural extensibility. These foundations are addressed first so that Phase 2 is built on a stable base.

## 1.3 Document Scope

### 1.3.1 In Scope

- Reliability, security and maintainability optimisation of the existing BNPL middleware system
- The BNPL credit risk framework: customer reliability scoring, tiered payment rules, no-show handling, concurrent exposure limits and full traceability
- Multi-tenant settlement: retention and enhancement of Stripe Connect, commission ledger, settlement management and payout management
- Full database refactor with an incremental, non-destructive migration path
- Phase 2 platform functionality across the customer front end, operator back office and platform administration console
- Inventory engine, dynamic pricing rules, add-on services and location management
- Hybrid AI chatbot, mobile application and WhatsApp Business integration
- Marketing promotions and channel attribution
- SARIMA demand forecasting extended into dynamic pricing suggestions
- Compliance and document management, and a feature flag mechanism
- Test strategy, observability and backup strategy
- Non-functional requirements, constraints, a phased development plan and risk management

### 1.3.2 Out of Scope

- Multi-country and multi-currency support. The platform targets Malaysia only, with MYR as the single currency
- Fully self-service operator onboarding. Operators are reviewed and admitted manually by the platform administrator
- Self-hosted or self-trained large language models
- Web scraping of third-party sites for inventory data
- A complete financial accounting system. Only transaction, settlement, refund and payout records are retained
- Full vehicle condition management at handover. Only a basic record structure is reserved, and the capability is listed under future scope

## 1.4 Definitions and Abbreviations

| Term | Definition |
| --- | --- |
| BNPL | Book Now Pay Later, the deferred payment booking model |
| RBAC | Role-based access control |
| CUID | Collision-resistant distributed unique identifier, used as the database primary key |
| RLS | Row-level security, a data isolation mechanism enforced by the database |
| Operator | A merchant organisation such as a car rental company or tour agency |
| Listing | A sellable product published on the platform, covering car rental packages and tour packages |
| PDPA | Malaysia Personal Data Protection Act 2010 |
| UAT | User acceptance testing |
| Stripe Connect | The Stripe multi-merchant product that splits funds between platform and operator |
| UTM | Marketing attribution parameters used to trace the origin of a booking |
| No-show | A customer with a confirmed booking who does not appear to use the service |
| Exposure | The number of confirmed bookings a customer holds that are not yet fully paid |
| RPO / RTO | Recovery point objective and recovery time objective, the backup and disaster recovery targets |
| MYT | Malaysia Time, UTC+8, the single civil time zone used across Malaysia |

