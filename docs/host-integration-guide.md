# BNPL Host Integration Guide

Integrate "Book Now Pay Later" into your site in two steps: a server-side call
to create a booking, and a one-line front-end snippet to open the modal.

## Prerequisites
- An **operator account** on the BNPL platform (created by the BNPL admin).
- Your **API key** and **operator code** (Operator dashboard → Settings →
  Integration / API Keys). Keep the API key server-side only.
- Your site's **origin** registered under "Allowed embed origins"
  (e.g. `https://example.com`).

## Step 1 — Create a booking (server-side)
`POST https://<bnpl-api>/api/host/bookings`

Headers:
- `Content-Type: application/json`
- `x-bnpl-api-key: <YOUR_API_KEY>`

Canonical body:
| Field | Required | Notes |
|---|---|---|
| `operatorCode` | yes | Your operator code |
| `hostBookingRef` | yes | Your unique booking reference |
| `customerName` | yes | |
| `customerEmail` | yes | Identity for the BNPL account |
| `serviceName` | yes | What was booked |
| `serviceType` | no | e.g. "Vehicle Rental" |
| `totalAmount` | yes | Positive number |
| `pickupDateTime` | yes | ISO, includes time (e.g. `2026-09-01T10:00:00`) |
| `returnDateTime` | yes | ISO, includes time |
| `location` | no | |

Response includes a single-use **`handoffToken`** (valid ~3 minutes).
Alias field names (`checkInDate`, `startDate`, `dropoffDate`, snake_case, etc.)
are accepted for convenience, but the canonical names above are recommended.

## Step 2 — Open the modal (front-end)
Pass the `handoffToken` to the SDK:

```html
<script src="https://<bnpl-frontend>/embed/v1/bnpl-embed.js"></script>
<script>
  BNPL.open({
    handoffToken: "<HANDOFF_TOKEN_FROM_STEP_1>",
    onSuccess: function (b) { /* booking submitted: b.bookingCode */ },
    onClose:   function () { /* customer closed the modal */ }
  });
</script>