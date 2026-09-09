---
paths:
  - "src/modules/identity/**"
  - "src/modules/compliance/**"
  - "src/middleware/auth*"
---

# Identity, auth and compliance

Spec: `docs/srs/06-system-architecture.md` 6.4.

## Tokens

- Access token 60 minutes; refresh token 7 days, stored in the database and
  revocable.
- Account status and operator status are checked **on every authenticated
  request**. An admin disabling an account must take effect immediately, not
  when a token expires.
- Refresh tokens rotate on use. Reuse of a consumed token revokes the family.

## WhatsApp channel

A Meta signature proves the message came from Meta. It does **not** prove the
sender owns the account attached to that phone number. Phone numbers get
recycled.

- Verify signature before any lookup.
- Only an identity with `verified_at` set counts as linked.
- First-time linking needs explicit confirmation: a one-time code, or a link
  initiated from an authenticated web session.
- Unverified session scope: browse, create a booking, pay for a booking created
  in that session. **No reading existing bookings, no personal data, no profile
  changes.**
- Even a verified WhatsApp session is narrower than web: password changes,
  document management and profile edits are web-only.

## Authorisation

One policy enforcement point in the request pipeline, after authentication and
before the orchestrator. It combines platform role, merchant role and resource
ownership. Modules do not run their own permission checks, so the matrix has
exactly one implementation.

## Documents

Identity documents go to the **private** Spaces bucket, served only through
short-lived presigned URLs. Listing images are public; documents are not. A
public URL to a customer's IC is a personal data incident.
