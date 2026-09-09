<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 4. Phase 2 Platform Requirements

## 4.1 Listing Catalogue Module

### 4.1.1 Package Information Management

**Requirement ID:** FR-LIST-001

Operators create, edit, publish and withdraw two categories of package. Car rental packages carry vehicle make, model, seat count, transmission, luggage capacity, description, images, pickup and return rules and insurance information. Tour packages carry package name, duration in days, highlights, a daily itinerary, inclusions and exclusions, cancellation policy, meeting point and maximum group size. Batch image upload, drag ordering and primary image selection are supported, with images stored in DigitalOcean Spaces.

### 4.1.2 Pricing Rule Engine

**Requirement ID:** FR-LIST-002

- Multi-dimensional pricing: base daily rate, weekend uplift, public holiday uplift and seasonal adjustment
- Rules are configured by date range and weekday mask, and support both fixed amount and percentage adjustment
- Multiple rules combine by priority, and the applicable rules are resolved at booking time to compute the final price
- Batch editing of prices and rules is supported

### 4.1.3 Inventory Management and Availability

**Requirement ID:** FR-INV-001

Inventory is managed at daily granularity. Each listing holds one availability row per date carrying the total quantity, the remaining quantity and a blocked indicator. A booking that spans several days must reserve every day in its range atomically, because reserving only part of a range would allow a booking to be confirmed against days that are already full.

The reservation is expressed as a single statement so that PostgreSQL locks the affected rows in a consistent order, which avoids deadlock between two overlapping multi-day bookings competing for the same dates.

```
UPDATE listing_availability
   SET remaining_quantity = remaining_quantity - :qty
 WHERE listing_id = :listing_id
   AND date >= :service_start_date
   AND date <  :service_end_date
   AND is_blocked = false
   AND remaining_quantity >= :qty;

-- assert affected row count = expected number of days, otherwise ROLLBACK
```

- The affected row count is compared against the expected number of days in the range. Any shortfall rolls the transaction back and the booking is refused, because a partial reservation is not a valid booking
- A date with no availability row is treated as unavailable. Treating a missing row as available would allow unlimited overselling on any date that has not been configured
- A nightly job extends availability rows forward on a rolling 180 day horizon, generating them from the listing default daily quantity, so that operators are not required to configure every future date by hand
- Cancellation, expiry, rejection and refusal release the reserved quantity back across the same date range. No-show does not release inventory, as defined in 3.5.4
- The reservation, the credit exposure check in 3.5.7 and the booking insert all run inside one transaction, so a booking is never created without its inventory, and inventory is never held without a booking

**Design reason:** V2.1 specified a single-row atomic decrement, which is correct for a one-day tour and silently wrong for a multi-day rental. The concurrency test defined against it would have passed while multi-day oversell remained possible, which is the most dangerous class of defect because the test provides false assurance.

**Business value:** Removes overselling at the storage layer for both single-day and multi-day products, and makes the guarantee provable by test rather than assertable by description.

### 4.1.4 Add-on Services

**Requirement ID:** FR-LIST-003

Operators configure optional add-on services per package, such as child seats, GPS units, additional insurance or airport transfer for car rental, and meal upgrades, private guides or attraction ticket upgrades for tours. Each add-on carries a unit price, is selectable during booking, and is included in the booking total and therefore in the commission base.

### 4.1.5 Location Management

**Requirement ID:** FR-LIST-004

- Operators maintain their own location library covering pickup points, return points, branches and tour meeting points, each with a name, full address, latitude and longitude and a location type
- Listings and locations have a many-to-many relationship through a join table, so that one package may offer several pickup or meeting points, and the role of each location for that listing is recorded
- Bookings record the specific pickup and return locations chosen by the customer
- Listings can be filtered by location

### 4.1.6 Dual-source Inventory Ingestion

**Requirement ID:** FR-LIST-005

Two ingestion paths are supported. Operators with an existing website push inventory through a JSON API, or expose a public JSON endpoint that the platform polls. Operators without a website enter package information manually in the back office. Both paths write to the same listing tables, so downstream functionality is unaffected by the source.

### 4.1.7 Bulk Listing Import

**Requirement ID:** FR-LIST-006

An operator joining the platform must get their existing fleet or catalogue into the system before they can trade. Entering fifty vehicles by hand, each with pricing rules and an availability calendar, is several hours of work, and it is the largest single reason an operator abandons onboarding. The API ingestion path in 4.1.6 only serves operators who already run a website, which most small operators in this market do not.

- A downloadable CSV template covering listing fields, base price and default daily quantity
- Given a valid file is uploaded, when it is processed, then listings and their availability rows are created and a summary of what was created is shown
- Given a row is invalid, when import runs, then that row is reported with the reason and every valid row still imports. A single bad row never fails the whole file
- Import is idempotent by an operator-supplied reference, so re-uploading a corrected file updates rather than duplicates
- Images remain a separate upload step, because they cannot travel in a CSV

**Design reason:** earlier versions specified how listings are created but never how an operator with an existing fleet gets started. The gap only became visible when the pilot was defined, and it sits directly on the path to having any supply at all.

**Business value:** reduces operator onboarding from hours to minutes, which is the difference between an operator trying the platform and giving up during setup.

## 4.2 Customer Web Front End

### 4.2.1 Home Page

**Requirement ID:** FR-CUST-001

Search bar covering business type, destination or pickup point, dates and party size; category entry points for car rental and local tours; featured packages; announcement carousel.

### 4.2.2 Search and Filtering

**Requirement ID:** FR-CUST-002

- Full-text keyword search
- Car rental filters: vehicle type, price range, seat count, transmission, pickup and return location, operator
- Tour filters: destination, duration, departure date, price range, group type, party size
- Sorting by price ascending, sales volume, most recently listed, and rating where the review display flag is enabled

### 4.2.3 Package Detail Page

**Requirement ID:** FR-CUST-003

Image carousel, key information, detailed specification and itinerary, pricing rules, cancellation policy, operator information, add-on selection, frequently asked questions and a fixed booking bar. The review section is rendered only when the review display feature flag is enabled, as described in 4.10.

### 4.2.4 Booking Confirmation Flow

**Requirement ID:** FR-CUST-004

Select dates and party size, select add-ons, enter contact and identification details, review the booking summary including the generated payment schedule, accept the terms, and submit. Where the customer has reached the concurrent exposure limit for their tier, the flow explains this before submission rather than failing at the final step.

### 4.2.5 Payment and Result

**Requirement ID:** FR-CUST-005

Payment method selection, display of the full payment schedule and each due date with a countdown, credit tier indication, and a result page showing success or failure, the booking reference and the next step. Where a deposit and balance apply, both due dates are shown together so that the customer is never surprised by a second deadline.

### 4.2.6 Personal Centre

**Requirement ID:** FR-CUST-006

My bookings with status filtering, booking detail, cancellation request and appeal entry point; profile editing; identification document management; notification centre; document download; credit record with the reason for each change; help centre.

## 4.3 Operator Back Office

### 4.3.1 Operations Dashboard

**Requirement ID:** FR-OP-001

Key metric cards for today’s pending orders, today’s confirmed orders, today’s revenue and month-to-date volume; seven day volume and revenue trend charts; shortcut actions.

### 4.3.2 Order Management Centre

**Requirement ID:** FR-OP-002

Order list with multi-condition filtering, order detail, batch accept, reject and suggest alternative, internal notes, cancellation review, and the no-show marking action described in 3.5.4 with its mandatory remark and enforced marking window.

### 4.3.3 Inventory Calendar

**Requirement ID:** FR-OP-003

Calendar visualisation of daily bookings and remaining availability, with the ability to block dates and adjust the daily quantity directly from the calendar. Dates beyond the generated horizon are shown as not yet open rather than as unavailable, so that the distinction is clear to the operator.

### 4.3.4 Pricing Rule Configuration

**Requirement ID:** FR-OP-004

Visual configuration of base price, weekend and public holiday uplifts and seasonal adjustment, with batch rule management and a preview of the resulting price for a selected date range.

### 4.3.5 Shop Settings

**Requirement ID:** FR-OP-005

Shop profile, transaction rules including deposit percentage and payment deadline, the no-show marking window, notification preferences, location management, and cancellation and refund policy configuration.

### 4.3.6 Settlement and Commission Reports

**Requirement ID:** FR-OP-006

Commission ledger, payout records and itemised detail, exportable reconciliation reports, and account balance and payout history. Each ledger line shows the gross amount, discount, who funded the discount, commission, payment processing fee and the resulting net, so that the operator can verify the arithmetic described in 3.1.5.

### 4.3.7 SARIMA Dynamic Pricing Suggestions

**Requirement ID:** FR-OP-007

The SARIMA demand forecast is used to produce pricing suggestions, recommending an increase during forecast peaks and a promotional reduction during troughs. Suggestions appear as dashboard prompts and the operator decides whether to adopt them.

> Cold start: a newly launched standalone platform has no booking history for the model to learn from. Until an operator reaches a defined minimum booking history the dashboard shows the module as awaiting sufficient data rather than displaying a low-confidence forecast. Phase 1 middleware history is used to seed the model where it exists.

## 4.4 Platform Administration Console

### 4.4.1 Platform Overview Dashboard

**Requirement ID:** FR-ADM-001

Platform-wide metrics for total bookings, total revenue, active operators and registered users; live figures for today; seven day trends; and alerts covering payment failure rate, callback backlog and scheduled task failures.

### 4.4.2 Operator Lifecycle Management

**Requirement ID:** FR-ADM-002

Operator registration review, operator list, account enable and disable, password reset, operator performance data and operator staff management.

### 4.4.3 Global Order Control

**Requirement ID:** FR-ADM-003

Platform-wide order search and filtering, order detail, intervention on exceptional orders including forced cancellation and status change, with every action written to the audit log.

### 4.4.4 Credit Appeal Review

**Requirement ID:** FR-ADM-004

- A queue of pending credit appeals showing the disputed event, the related booking, the operator remark and the customer statement
- Upholding an appeal writes a reversing credit event and recomputes the tier. Rejecting it records the decision and the reason
- Every decision is written to both the credit event log and the audit log

**Design reason:** The no-show requirement promises administrator review, which requires an owner, a queue and a decision record. Without this the appeal path exists only as a sentence.

### 4.4.5 Marketing Campaign Management

**Requirement ID:** FR-MKT-001

- Create campaigns, generate promotion codes and configure usage rules covering threshold discounts, percentage discounts, minimum spend, validity period and usage limits
- Campaigns are either platform level or operator level. A platform campaign is funded by the platform and an operator campaign is funded by the operator, as defined by funded_by and applied by the commission formulas in 3.1.5
- A platform-funded campaign whose maximum discount would exceed the platform commission is rejected at creation unless explicitly overridden, and the projected margin impact is displayed before the campaign is saved

### 4.4.6 Attribution Reporting

**Requirement ID:** FR-MKT-002

Redemption data by campaign and channel attribution reporting built from the UTM parameters captured on each booking, showing which channels produced bookings and at what commission cost.

### 4.4.7 System Settings Centre

**Requirement ID:** FR-ADM-005

Platform profile, global transaction rules, global commission configuration, credit tier thresholds and exposure limits, email templates, feature flag management and system parameters.

### 4.4.8 Content Operations (Phase 4)

**Requirement ID:** FR-MKT-003

Home page carousel management, featured placement configuration and platform announcements. Deferred to Phase 4. For the Phase 3 demonstration the home page uses seeded content, which is stated here so that the dependency is explicit rather than discovered during integration.

### 4.4.9 Pilot Metrics View

**Requirement ID:** FR-ADM-006

- A single administration screen showing, for a selected period: bookings created, paid, completed, expired and marked no-show
- On-time payment rate and expiry rate broken down by credit tier, which is the comparison the project’s evaluation rests on
- Gross booking value, commission revenue and settled payout totals
- Export to CSV so the figures can be used directly in the project report

**Design reason:** the weekly pilot review in 9.7 has to be quick to prepare. A review that requires someone to write queries will stop happening in the week it matters most.

## 4.5 Hybrid AI Chatbot

### 4.5.1 Layered Conversation Architecture

**Requirement ID:** FR-CHAT-001

Three layers in order: a rule engine, an LLM fallback, and escalation to a human. High-frequency questions are answered by the rule layer, anything it cannot handle passes to the LLM, and anything still unresolved escalates.

### 4.5.2 Rule Engine Layer

**Requirement ID:** FR-CHAT-002

Preset answers and quick action menus for common questions including booking status, payment schedule and due dates, cancellation policy, credit tier explanation and receipt upload guidance.

### 4.5.3 LLM Fallback

**Requirement ID:** FR-CHAT-003

Open questions are handled by the Claude Haiku API with the customer’s own booking context injected. Prompt caching, rate limiting and minimal data transfer control both cost and data exposure. The chatbot may only access data belonging to the signed-in user, enforced at the query layer rather than by prompt instruction.

### 4.5.4 Escalation and Conversation Persistence

**Requirement ID:** FR-CHAT-004

- Unresolved questions raise a ticket and notify the relevant operator
- All conversations and messages are persisted, with history and read state
- Operators reply from the back office and the full transcript is retained

## 4.6 Mobile Application (Phase 4)

**Requirement ID:** FR-CHAN-001

Built with React Native and Expo for iOS and Android. The customer application covers home, search and filtering, package detail, booking and payment, my bookings, push notifications, the chatbot and receipt photo upload.

## 4.7 WhatsApp Business Integration (Phase 4)

**Requirement ID:** FR-CHAN-002

WhatsApp Flows provide in-chat booking forms, automated status updates and payment link delivery. Phone number identity is linked to the platform account through the user_identities table, so that a booking created in WhatsApp belongs to a real account and appears in that customer’s personal centre rather than creating an orphan record.

## 4.8 Analytics and Reporting

**Requirement ID:** FR-ANL-001

Operator side: revenue trends, booking conversion funnel, sales ranking, demand forecast and pricing suggestions. Administrator side: cross-operator operational reporting, platform conversion analysis and marketing attribution reporting.

Product event instrumentation, which supplies the data behind both of these and behind the pilot evaluation, is specified separately as FR-ANL-002 in Section 9.4.

## 4.9 Compliance and Document Management

### 4.9.1 Consent Records

**Requirement ID:** FR-COMP-001

Consent to the privacy policy, terms of service, marketing notifications and WhatsApp notifications is recorded with the time granted and the source IP address, so that the PDPA compliance claim rests on evidence rather than assertion.

### 4.9.2 Structured Document Management

**Requirement ID:** FR-COMP-002

- Operator business licences and customer driving licences are stored as structured records carrying document status, expiry date and review history
- Identity documents are stored in a private Spaces bucket and served only through short-lived presigned URLs. They are never public-read, unlike listing images
- Expiring documents raise a notification to the owner and to the administrator

> The public-read setting appropriate for listing images would expose identity documents to anyone holding the URL, which would be a personal data incident and would undermine the compliance position taken in Section 8.3. The two buckets are therefore configured separately.

## 4.10 Review and Trust System

**Requirement ID:** FR-TRUST-001

For a new marketplace whose operators are unknown to consumers, review volume is the strongest single conversion signal. The capability is split across phases so that the Phase 2 interface does not depend on Phase 4 delivery.

- Phase 1: the reviews table is created as part of the schema refactor and a read API is provided. This costs almost nothing and avoids a later migration
- Phase 2: rating display on the detail page and rating sort in search are implemented behind the review display feature flag, so the interface can ship switched off
- Phase 4: review submission by customers and operator replies are delivered, and the flag is enabled
- Only a customer whose booking reached completed status may review it, enforced by a unique constraint on the booking reference

**Design reason:** V2.1 placed reviews entirely in optional Phase 4 while the Phase 2 detail page and search sorting already referenced them, which would have left two Phase 2 deliverables blocked on an optional phase.

