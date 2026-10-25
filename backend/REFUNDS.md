# Card refunds and DuitNow amounts

## Card (Stripe) refunds from the operator portal

Card payments are taken on the platform's Stripe account, so refunds are sent with the platform's key. An operator no longer needs the Stripe dashboard or an administrator.

1. A refund record is created when a paid booking is cancelled (by the customer or the operator) or when the operator picks "Process Partial Refund".
2. Operator portal, Booking detail, Refund card: **Refund to Customer's Card** (or **Retry Card Refund** after a failure).
3. `POST /operators/bookings/:id/refunds/:refundId/process` (operator owner only) calls Stripe, marks the refund REFUNDED, reverses the commission ledger, writes an audit entry and notifies the customer.
4. DuitNow refunds keep **Mark as Refunded**: the money is sent outside the platform.

Safeguards: one request at a time per refund, a refund Stripe already made for the same record is reused, two-part payments are refunded from both Stripe payments, and a refund is refused once the operator's payout has been transferred (an administrator must reverse the payout first).

Refunds come out of the platform's Stripe balance, and Stripe does not return its processing fee.

The `charge.refunded` webhook now finds the payment by any of its Stripe payment ids and only records money refunded outside the platform (for example in the Stripe dashboard).

## DuitNow amounts

`GET /customer/bookings/:id/manual-payment` returns the amount, due date and reference for each part still to pay, taken from the payment schedule. The upload page shows them read-only. The receipt stores the part and the expected amount, and the operator sees "Amount to match" when verifying.

## How to test (Stripe test mode)

1. Pay a deposit with card `4242 4242 4242 4242`, then cancel the booking as the customer or operator.
2. As the operator owner, open the booking, Refund card, press **Refund to Customer's Card**. The refund should become Refunded and appear in the Stripe test dashboard.
3. Press it twice quickly: only one Stripe refund is made.
4. Upload a DuitNow receipt: the amount and reference are pre-filled, and the operator's receipt window shows the same amount.

Run `npm test` in `backend`. The new tests are `stripe_refund_service.test.js` and `manual_payment_options.test.js`.
