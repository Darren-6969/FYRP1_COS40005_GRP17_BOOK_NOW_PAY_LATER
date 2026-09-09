<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 5. Database Architecture

## 5.1 Problems Addressed

1. No independent operator organisation entity, leaving operator foreign keys pointing at nothing
2. Two sources of truth for roles, creating a class of permission defect
3. Core capabilities with no corresponding data model, including settlement, inventory detail, pricing rules and credit risk
4. The credit system had no recording path for no-shows and no history for credit changes
5. A single payment deadline could not express tiered multi-instalment payment
6. Promotion cost attribution and the commission base were undefined, creating settlement ambiguity
7. No multi-channel identity mapping, so WhatsApp bookings would create orphan users
8. Missing engineering tables, leaving idempotency and callback reliability without persistence
9. Service dates held only inside JSON, making them unqueryable and unindexable by the features that depend on them
10. A polymorphic document owner that cannot carry a foreign key, allowing orphaned identity records

## 5.2 Design Principles

- Incremental compatibility: migration is additive and does not destroy historical data
- Organisation first: an independent operator entity, with every business foreign key pointing at it
- End-to-end traceability: state changes on core entities are always recorded
- Constraints pushed down: integrity is enforced by the database rather than by application code
- Capability alignment: every functional requirement has a supporting data model
- Queryable by default: any value that drives a deadline, a filter, a job or a settlement decision is a column, not a JSON field
- Forward extension: Phase 2 structures are provided now to avoid a second refactor

## 5.3 Data Model

### 5.3.1 Organisation, Users and Permissions

| Table | Key Fields | Notes |
| --- | --- | --- |
| operators | id (cuid, PK), company_name, business_license, status (enum), created_at, updated_at | Operator organisation entity. Every operator_id across the schema references this table |
| users | id (cuid, PK), email (UNIQUE), password_hash, name, phone, is_active, created_at, updated_at | Account base table holding authentication data only |
| user_platform_roles | user_id (FK), role (enum: customer/admin), PRIMARY KEY (user_id, role) | Platform-level roles only. Composite key so that one account may hold more than one platform role |
| operator_members | id (PK), operator_id (FK), user_id (FK), staff_role (enum: manager/staff), joined_at, UNIQUE (operator_id, user_id) | The single source of truth for merchant-scoped roles |
| user_identities | id (PK), user_id (FK), channel (enum), external_id, verified_at, UNIQUE (channel, external_id) | Multi-channel identity mapping linking WhatsApp and OAuth identities to platform accounts |
| customer_profiles | user_id (PK, FK), address, whatsapp_opt_in | Customer extension. Identity documents are held in documents, not here |
| user_consents | id (PK), user_id (FK), consent_type (enum), granted_at, ip_address | Consent records supporting PDPA compliance |
| documents | id (PK), user_id (FK, nullable), operator_id (FK, nullable), doc_type (enum), file_url, status (enum), verified_by (FK), expires_at, CHECK (num_nonnulls(user_id, operator_id) = 1) | Document management with real foreign keys. Exactly one owner column is populated, enforced by the check constraint |

> The documents table was polymorphic in V2.1, using an owner type and a loose owner identifier. That pattern cannot carry a foreign key, so nothing prevented an orphaned identity document, which contradicts the constraints pushed down principle. Two nullable typed columns with a check constraint give the same flexibility with real referential integrity.

### 5.3.2 Configuration and Settings

| Table | Key Fields | Notes |
| --- | --- | --- |
| system_settings | id (PK), platform_name, default_payment_deadline_hours, platform_fee_rate, tier_thresholds (jsonb), exposure_limits (jsonb) | Global configuration maintained by the administrator, including credit tier thresholds and exposure limits |
| operator_settings | operator_id (PK, FK), payment_deadline_hours, down_payment_percent, no_show_window_hours, notification_preferences | Per-operator configuration including the no-show marking window |
| feature_flags | id (PK), flag_key (UNIQUE), name, description, is_enabled_global, enabled_operators | Feature flag configuration by environment and operator |
| cancellation_policies | id (PK), operator_id (FK, nullable), listing_id (FK, nullable), min_hours_before, refund_percent, priority | Refund rule tiers. Resolution order is listing, then operator, then system default |

### 5.3.3 Credit Risk

| Table | Key Fields | Notes |
| --- | --- | --- |
| customer_risk_profiles | user_id (PK, FK), completed_count, expired_count, no_show_count, cancel_count, tier (enum), on_time_rate, last_computed_at, manual_override_by | Current credit snapshot, recomputed after each terminal status change |
| customer_risk_events | id (PK), user_id (FK), event_type (enum), booking_id (FK), from_tier, to_tier, reason, state (enum: active/appealed/reversed), reverses_event_id (FK, nullable), appeal_reason, actor_id (FK), created_at | Credit change history including appeal state. A reversal is a new event referencing the original, so history is never rewritten |

### 5.3.4 Listings and Inventory

| Table | Key Fields | Notes |
| --- | --- | --- |
| listings | id (cuid, PK), operator_id (FK), type (enum: car/tour), title, description, base_price, is_active, source (enum), vehicle_type, seats, transmission, luggage_capacity, tour_duration, destination, default_daily_quantity, extra_attrs (jsonb) | Listing master. Filterable attributes are structured columns; genuinely variable attributes go in JSONB |
| listing_images | id (PK), listing_id (FK), image_url, sort_order, is_primary | Listing images |
| listing_availability | listing_id (FK), date, total_quantity, remaining_quantity, is_blocked, PRIMARY KEY (listing_id, date), CHECK (remaining_quantity >= 0) | Daily inventory. The composite key and the check constraint are what make the atomic range decrement safe |
| rate_rules | id (PK), listing_id (FK), rule_type, date_start, date_end, weekday_mask, adjustment_type, adjustment_value, priority | Pricing rules |
| listing_addons | id (PK), listing_id (FK), name, description, price, is_active | Optional add-on services |
| locations | id (PK), operator_id (FK), name, address, lat, lng, location_type (enum), is_active | Operator location library |
| listing_locations | listing_id (FK), location_id (FK), location_role (enum), PRIMARY KEY (listing_id, location_id, location_role) | Listing to location many-to-many association |

### 5.3.5 Bookings and Transactions

| Table | Key Fields | Notes |
| --- | --- | --- |
| bookings | id (cuid, PK), customer_id (FK), operator_id (FK), listing_id (FK), status (enum), channel (enum), service_start_at (timestamptz), service_end_at (timestamptz), quantity, gross_amount, discount_amount, net_amount, pickup_location_id (FK), dropoff_location_id (FK), utm_source, utm_medium, utm_campaign, booking_details (jsonb) | Booking master. Service dates and quantity are first-class columns because inventory, payment schedules, no-show marking and settlement all depend on them |
|  | INDEX (operator_id, service_start_at), INDEX (status, service_start_at), INDEX (customer_id, status) | Supporting indexes for the operator calendar, the no-show and expiry sweeps, and the exposure limit count |
| booking_status_history | id (PK), booking_id (FK), from_status, to_status, changed_by (FK), remark, changed_at | One record per status change |
| booking_addons | id (PK), booking_id (FK), addon_id (FK), quantity, unit_price, total_price | Selected add-ons |
| payment_schedules | id (PK), booking_id (FK), sequence, due_date (timestamptz), amount, status (enum: pending/paid/voided), UNIQUE (id, booking_id), UNIQUE (booking_id, sequence) | Instalment plan. The composite unique key exists so that payments can reference it compositely |
| payments | id (PK), booking_id (FK), payment_schedule_id (FK), status (enum), payment_method (enum), amount, transaction_id, receipt_url, FOREIGN KEY (payment_schedule_id, booking_id) REFERENCES payment_schedules (id, booking_id) | Payment records. The composite foreign key makes it impossible for a payment to reference a schedule belonging to a different booking |
| refunds | id (PK), payment_id (FK), amount, reason, status, processed_by (FK), processed_at | Independent refund records supporting partial refunds |
| invoices | id (PK), booking_id (FK, UNIQUE), invoice_no (UNIQUE), amount, issued_at | One invoice per booking |

> bookings.promotion_id was removed in this revision. promo_redemptions already holds the booking and promotion pair, and keeping the reference in two places would recreate exactly the dual source of truth problem that was fixed for roles in V2.1. A unique constraint on promo_redemptions.booking_id enforces one promotion per booking.

### 5.3.6 Settlement

| Table | Key Fields | Notes |
| --- | --- | --- |
| operator_payout_accounts | operator_id (PK, FK), stripe_account_id, onboarding_status (enum), payout_schedule (enum), default_currency | Stripe Connect binding |
| commission_ledger | id (PK), booking_id (FK), payment_id (FK), operator_id (FK), gross_amount, discount_amount, net_amount, funded_by (enum), fee_rate, fee_amount, stripe_fee_amount, operator_net, settlement_status (enum), settleable_at | Commission ledger. funded_by and fee_rate are snapshotted at payment time. The payment processing fee has its own column so the ledger reconciles line by line against the Stripe balance report |
| payouts | id (PK), operator_id (FK), total_amount, total_fee, status, stripe_payout_id, period_start, period_end | Payout record. Only ledger entries whose booking has reached a settleable terminal status are included |
| payout_items | id (PK), payout_id (FK), commission_ledger_id (FK, UNIQUE), booking_id (FK), net_amount | Payout line items. The unique constraint prevents a ledger entry being paid out twice |

### 5.3.7 Promotions

| Table | Key Fields | Notes |
| --- | --- | --- |
| promotions | id (PK), code (UNIQUE), name, type (enum), value, min_order_amount, max_usage, usage_count, valid_from, valid_to, is_active, operator_id (FK, nullable), funded_by (enum: platform/operator), margin_override_by (FK, nullable) | Campaign definition. A null operator indicates a platform campaign. The override field records who approved a campaign exceeding the commission cap |
| promo_redemptions | id (PK), promotion_id (FK), booking_id (FK, UNIQUE), user_id (FK), redeemed_at, discount_amount | Redemption records, the single source of truth for the promotion applied to a booking |

### 5.3.8 Chat

| Table | Key Fields | Notes |
| --- | --- | --- |
| chat_conversations | id (PK), customer_id (FK), operator_id (FK), status (enum), created_at, escalated_at | Conversation records |
| chat_messages | id (PK), conversation_id (FK), sender_role (enum), sender_id (FK), content, is_read, created_at | Message persistence |
| chat_escalations | id (PK), conversation_id (FK), reason, assigned_to (FK), status, created_at | Escalation tickets |

### 5.3.9 Reviews

| Table | Key Fields | Notes |
| --- | --- | --- |
| reviews | id (PK), booking_id (FK, UNIQUE), customer_id (FK), operator_id (FK), listing_id (FK), rating, comment, operator_reply, created_at | Booking-verified reviews. Created in Phase 1, displayed in Phase 2 behind a feature flag, submission delivered in Phase 4 |

### 5.3.10 Notifications, Audit and Operations

| Table | Key Fields | Notes |
| --- | --- | --- |
| notifications | id (PK), user_id (FK), type, title, content, is_read, created_at | In-app notifications |
| notification_logs | id (PK), user_id (FK), channel (enum), status, failure_reason, retry_count, created_at | Delivery logging for email and WhatsApp |
| audit_logs | id (PK), actor_id (FK), action, entity_type, entity_id, before_data (jsonb), after_data (jsonb), ip_address, created_at | Audit trail for sensitive actions |
| cron_job_logs | id (PK), job_name, status, start_time, end_time, processed_count, error_msg | Scheduled task execution logging |
| idempotency_keys | idempotency_key (PK), endpoint, request_hash, response_body, created_at, expires_at | Idempotency persistence |
| webhook_events | id (PK), provider (enum), external_event_id (UNIQUE), raw_payload, processed, processed_at, error_message | Callback persistence supporting idempotent handling, retry and reconciliation replay |
| job_queue | id (PK), job_type (enum), payload (jsonb), status (enum: pending/processing/completed/failed), claimed_at, lease_expires_at, retry_count, next_retry_at, error_message, created_at, INDEX (status, next_retry_at) | Background work and the outbox. Jobs are enqueued inside the business transaction that created them, so committing the data commits the work owed. Claimed with FOR UPDATE SKIP LOCKED under a lease, so a crashed or redeployed worker does not strand jobs. See 6.3.2 |
| analytics_events | id (PK), event_name, user_id (FK, nullable), operator_id (FK, nullable), booking_id (FK, nullable), properties (jsonb), occurred_at, INDEX (event_name, occurred_at), INDEX (operator_id, occurred_at) | Product event capture supporting FR-ANL-002. The properties bag carries the credit tier on booking events, which is what makes the per-tier evaluation in 9.6 possible. Reference identifiers only, never personal data |

> job_queue and analytics_events are new in V2.4. The first was referenced throughout the architecture in Section 6 but had no table, which is exactly the capability alignment failure principle 5.2 exists to prevent. The second did not exist at all, and without it the pilot would have run with no way to measure whether it worked.

### 5.3.11 Growth (Phase 4)

| Table | Key Fields | Notes |
| --- | --- | --- |
| user_favorites | id (PK), user_id (FK), listing_id (FK), created_at, UNIQUE (user_id, listing_id) | Saved listings |

## 5.4 Key Design Decisions

1. Operator as an organisation. Operators are promoted from a user role to an organisation entity, matching how merchants actually work, with every business foreign key pointing at one table.
2. A single source of truth for roles. Platform roles and merchant roles are held in separate tables with no overlap, which removes the dual data source defect while still allowing one person to hold several identities.
3. Unified payment scheduling. All due payments live in payment_schedules, so deposits, balances and any future instalment plan share one monitoring path.
4. Queryable service dates. Any value that drives a deadline, a filter, a scheduled job or a settlement decision is a column. Service dates were the last significant exception and are now first-class.
5. Range-atomic inventory. A multi-day reservation is one statement across the full date range with a row-count assertion, which is both deadlock-safe and provably correct under concurrency.
6. Traceable credit decisions. Every credit change is recorded, appeals are modelled as reversing events, and history is never rewritten.
7. Explicit financial rules. Promotion cost attribution, the commission base and the settlement trigger are all stated as formulas and conditions rather than left to implementation.

## 5.5 Migration Path

Two separate risks are being taken during this project: moving the database from Neon to DigitalOcean Managed PostgreSQL, and refactoring the schema. Combining them makes any failure difficult to attribute, so they are sequenced.

1. Take a full backup of the existing database with pg_dump and verify that the backup restores successfully
2. Lift and shift the existing schema and data to DigitalOcean Managed PostgreSQL unchanged, and verify that the application runs against it without modification
3. Rehearse the full refactor migration in a test environment against a production-sized snapshot, recording row counts per table before and after and timing the run
4. Create the new tables, enumerations, indexes and constraints incrementally
5. Run the data migration scripts: initialise operator entities, split the user and configuration tables, backfill service dates from booking_details, generate payment schedules from existing deadlines and deposits, generate availability rows, and initialise credit profiles
6. Add foreign key and not-null constraints once the data satisfies them
7. Update the Prisma schema and all data access code
8. Verify with limited production traffic, then switch over fully
9. Remove redundant columns and legacy tables once the system is stable

> Backfilling service dates in step five is the migration’s highest-risk item, because historical bookings hold those dates in free-form JSON. Records that cannot be parsed are written to an exception table for manual review rather than being given a guessed value, and the count of such records is a release gate.

