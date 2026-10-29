# Cancellation and refunds

Built from `BNPL_Cancellation_Policy_and_Flow.pdf` and `BNPL_Refund_Policy_and_Flow.pdf` (28 Oct 2026).

## The money

One calculation, `src/services/refund_policy.js`, decides every refund. The quote a customer sees, the refund a cancellation creates and the amount the sweep refunds can never disagree.

1. Nothing is charged before the operator accepts, so nothing is refunded (rows A, B).
2. The **deposit** follows the shop's rule: kept by default, or the operator's elected percentage back. The election counts only for a car rental whose pickup date is not on the platform peak calendar.
3. The **balance** is refunded in full whenever it was paid.
4. Everything paid comes back when the operator cancels a paid booking that is not overdue (row H), when the platform is at fault (row I), or when an administrator records an operator or platform fault.

| Row | Case | Result (RM 500, 30% deposit, 60% election) |
| --- | --- | --- |
| C | Deposit paid, customer cancels | RM 0, or RM 90 where elected |
| D | Paid in full, customer cancels | RM 350, or RM 440 where elected |
| E | Deposit paid, balance missed (sweep, or operator on an overdue booking) | RM 0, or RM 90 |
| E2 | Paid in full, licence missed (sweep) | RM 350, or RM 440 |
| H | Operator cancels a paid booking | Everything paid |

## Cancelling

`src/services/booking_cancellation_service.js` runs the same steps for every canceller:

1. The booking moves to Cancelled; the history records who, why and when (`cancelledBy`, `cancellationReasonCode`, `cancellationNote`, `cancellationFault`, `cancelledAt`).
2. Unpaid schedule entries are voided, which releases the car.
3. One Pending refund per part owed (deposit, balance).
4. The customer (in-app and email) and the operator are told, with the reason and the refund.
5. It is recorded against whoever caused it: a customer cancellation after acceptance adds a `CUSTOMER_CANCELLATION` credit event (record only, never lowers the tier); an operator cancellation is the `OPERATOR_BOOKING_CANCELLED` audit entry the pilot metrics count; an administrator's records the fault.

| Who | When | Reason |
| --- | --- | --- |
| Customer | From request to pickup time | Optional list |
| Operator | From acceptance to pickup time (Overdue too) | List plus a note |
| Administrator | Before the rental starts | Reason plus who was at fault |
| System | Sweep: missed balance or licence | Automatic |

After pickup time a customer and an operator can no longer cancel (the operator marks a no-show).

## Paying it back

- **Card:** sent to Stripe the moment the booking is cancelled, split over both payments of a two-part booking, never twice. If Stripe refuses it the refund is Failed and the operator or an administrator presses **Retry Card Refund**. Refused outright once the operator's payout has been transferred.
- **DuitNow:** the operator sends the money and presses **Mark as Refunded** with the transfer reference, by a deadline (`refundDeadlineBusinessDays`, set in System Settings). `refundDeadline_job` reminds daily at 09:00 Malaysia time, escalates to the administrator once the deadline passes, and an overdue refund counts in the operator metrics (4.4.9).
- The commission ledger is reversed in proportion; Stripe's fee is absorbed by the platform.

## Where

- Customer: booking page, cancel dialog with the refund quote and an optional reason, refund summary.
- Operator: booking page (cancel dialog, refund card), "Refunds to send" on the bookings list.
- Administrator: Bookings, **Cancel booking** (fault and reason, refund shown before confirming); **Refunds** page; the refund deadline in System Settings.
- API: `GET /customer/bookings/:id/cancellation-quote`, `GET /bookings/:id/cancellation-quote`, `POST /bookings/:id/admin-cancel`, `GET /refunds`, `POST /refunds/:id/retry`.

## Not done

Public-site wording (Darren's screens), recording a no-show as a no-show on the customer's credit, a "past cancellations" figure in the operator's customer panel (it is in the cancel dialogs), and public holidays in the business-day count.

## Testing

`npm test` in `backend`. New: `refund_policy`, `booking_cancellation_service`, `refund_deadline_service` (plus the overdue-refund cases in the pilot metrics tests). Stripe test mode: pay a deposit with card `4242 4242 4242 4242`, cancel as customer, operator and administrator, and watch the refunds in the Stripe test dashboard.
