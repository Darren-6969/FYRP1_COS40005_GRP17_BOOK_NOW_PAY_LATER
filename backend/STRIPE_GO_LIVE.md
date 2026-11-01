# Moving from the Stripe sandbox to the client's business account

Test mode and live mode are separate worlds in Stripe: separate keys, webhook endpoints, signing secrets, connected accounts and data. Nothing from the sandbox carries over. Do the steps in order; `GET /api/stripe/readiness` (administrator) and the server's start-up log check the configuration part.

## 1. What the client's Stripe account needs

- A **Malaysian** Stripe account that is fully activated (business details, bank account for payouts). FPX and GrabPay are only available to Malaysian businesses, and amounts must be in MYR.
- **Connect enabled** in live mode, with the platform profile completed. Operators are onboarded as Express accounts through `/api/stripe/onboarding-link` (they must have the `transfers` capability).
- **Payment methods** turned on in Settings, Payment methods: card, FPX and GrabPay (the checkout asks for all three). FPX has a minimum of RM 2 and a maximum of RM 30,000.
- **Public details**: business name, statement descriptor and support email, because they appear on the customer's bank statement and Stripe receipts.
- **Balance**: refunds and operator payouts are paid from the platform's available balance. A refund the balance cannot cover waits as pending (Stripe fails it after 45 days), and a payout transfer fails with an insufficient balance error. Keep some available balance, or top it up.

## 2. Keys and environment variables (Dokploy, backend service)

| Variable | Live value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_...` (or a restricted `rk_live_` key with write access to Checkout Sessions, Payment Intents, Refunds, Transfers, Accounts and Account Links) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the live endpoint for your own account (step 3) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret of the live Connect endpoint (step 3) |
| `STRIPE_CONNECTED_ACCOUNT_ID` | **Remove it.** In the sandbox it sends every operator's payout to one account. |
| `STRIPE_CONNECT_ACCOUNT_COUNTRY` | `MY` (the default) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | The public `https://` address. Stripe returns customers to it after paying. |
| `STRIPE_PLATFORM_FEE_PERCENT` | Legacy. The commission rate comes from System Settings. |

Frontend: do not set `VITE_STRIPE_SANDBOX_HINT` (it only shows the test card on the checkout page). No publishable key is used: checkout is Stripe's hosted page.

The key is read when the server starts, so redeploy after changing it. Never commit a key, and rotate any key that has been pasted into a chat or a ticket.

## 3. Webhooks (Developers, Webhooks, in live mode)

Create **two** endpoints. They can use the same URL, `https://<backend domain>/api/stripe/webhook`; each has its own signing secret, and the server tries both.

| Endpoint | Events from | Events |
| --- | --- | --- |
| 1 | Your account | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `payout.created` (optional) |
| 2 | Connected accounts | `account.updated` |

- Choose the API version **2025-02-24.acacia**, which the installed Stripe library uses, so the events look the way the code expects.
- The server refuses an event from the wrong mode: a test event is rejected by a live key and the other way round.
- `refund.updated` / `refund.failed` matter for FPX and GrabPay: a bank refund can finish days later or fail, and the refund card then goes to Completed or Failed.
- A customer dispute is not handled automatically: `charge.dispute.created` alerts the administrator, who answers it in the Stripe dashboard before the evidence deadline.

## 4. Data

- Operators' `stripeAccountId` values and the payments and refunds in the database come from the sandbox. A sandbox payment id does not exist in live mode, so refunding it fails. Start live with a fresh database, or at least remove the sandbox bookings and payments.
- Every operator must be onboarded again (Operator Settings, Stripe). If you keep existing operators, clear their sandbox accounts first:

```sql
UPDATE "Operator"
SET "stripeAccountId" = NULL, "stripeOnboardingStatus" = 'NOT_STARTED', "stripeRequirements" = NULL;
```

## 5. How money flows (what to tell the client)

- The customer pays the **platform's** Stripe account (separate charges and transfers). The platform pays each operator by transfer after the service is resolved and the appeal window has passed.
- **Refunds** come out of the platform balance. A card refund goes out automatically when a booking is cancelled. A transfer already made to an operator is not reversed by a refund: the system refuses the refund once the payout has been transferred, and an administrator reverses the payout first.
- **Fees**: Stripe does not return its processing fee on a refund. The platform absorbs it and the ledger records it.
- **Pending refunds** (FPX, GrabPay, or a balance that is short) stay Processing until Stripe finishes them; FPX refunds are possible for 60 days after the payment.

## 6. Test it with real money before opening

1. Run `GET /api/stripe/readiness` as the administrator: no errors.
2. Onboard one real operator through the Connect flow until `transfers` is active.
3. Pay a small booking by card (and by FPX if enabled), as a real customer.
4. Cancel it as the customer: the refund card goes to Completed and the money returns. Repeat as the operator (everything back) and, if you can, with an FPX payment.
5. Confirm the webhook deliveries in Stripe show 200, and the booking, payment and ledger rows look right.
6. Let one booking run to completion past the appeal window and check the payout transfer arrives in the operator's account.

## 7. Going back

Switching back to the sandbox is the same steps reversed. Keep the live data: do not point sandbox keys at the live database.
