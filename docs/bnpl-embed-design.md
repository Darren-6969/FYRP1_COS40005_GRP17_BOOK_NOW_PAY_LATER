# BNPL Embedded WebView Modal — Design Doc

**Status:** Draft for review
**Owner:** BOOK NOW PAY LATER (COS40005 GRP17)
**Last updated:** 2026-08-03

---

## 1. Summary

Today the BNPL is launched from a host site (GoCar/CBS) by **popping open a separate
browser tab** pointing at the standalone BNPL React app, where the customer logs in
again. This doc describes moving to an **embedded WebView modal**: the host opens the
BNPL inside an in-page iframe modal, and the customer is authenticated via a
**host-issued handoff token** rather than a second manual login.

The design is **host-agnostic** — any future host onboards with a single JS snippet and
a server-to-server call, with no bespoke integration code.

### Locked decisions

| Decision | Choice |
|---|---|
| Auth model | **Model B** — host-issued token, no re-login inside the modal |
| First-use credit gate | **OTP step-up** — auto-login yields a *restricted* session; OTP required before confirming credit |
| Browser-visible token | **Separate single-use handoff token** (intent token stays server-side) |
| Embed hosting | **Vercel frontend + iframe** (`frame-ancestors` set on frontend) |
| API key provisioning | **Hybrid** — admin onboards/vets the operator; OWNER self-serves keys in dashboard |

---

## 2. Goals / Non-goals

**Goals**
- Embedded modal experience (no new tab) launched by a reusable SDK.
- Token-driven auth: the customer does not type BNPL credentials inside the modal.
- Works for **any** host without new backend/PHP code — onboarding is data + snippet.
- Credit-grade safety: delegated identity, but real verification before credit is committed.

**Non-goals (this phase)**
- Public operator self-registration page (deferred; see §11).
- Replacing the existing standalone BNPL app (it remains for direct/returning users).
- Changing the payment/checkout mechanics themselves.

---

## 3. Current state (as-is)

- **Host** (`cbs/vehicle_details.php`) collects the booking, then does a server-side
  cURL `POST /host/bookings` with header `x-bnpl-api-key`, using a **single global**
  `HOST_API_KEY`.
- **BNPL backend** `createHostBookingIntent` validates the key, creates a
  `HostBookingIntent` (24h, `PENDING`), returns `registerUrl`/`loginUrl`/`redirectUrl`
  + `intentToken`.
- **Host** then `window.open()`s the BNPL frontend in a new tab; the customer
  registers/logs in there; the frontend calls `POST /host/booking-intents/:token/claim`
  to convert the intent into a real `Booking`.
- **Security headers**: backend `helmet` sets `frameguard: deny` and CSP
  `frameSrc: ['none']`. CORS allows the frontend origins with `credentials: true`.

### Blockers for "every host"
1. **Single global API key** — every host would share one secret. Must become
   **per-operator** keys.
2. **`Operator` has no `allowedOrigins`** — needed for `frame-ancestors` + postMessage
   validation.
3. **Auth requires a manual login** inside the (separate) app — Model B removes this.

---

## 4. Key concepts

| Term | Meaning |
|---|---|
| **Host / Operator** | A partner site embedding BNPL. Modeled as an `Operator` row. |
| **API key** | Per-operator secret used server-to-server to create intents. Never in the browser. |
| **Intent token** | Server-side reference to a `HostBookingIntent`. Long-lived (24h). Not exposed to the browser in Model B. |
| **Handoff token** | Short-lived (≤3 min), **single-use** token handed to the browser to bootstrap the modal session. The diagram's "authentication token". |
| **Auth JWT** | The session token minted by exchanging the handoff token. Authorizes `/api/...` calls from inside the modal. Held **in memory**. |
| **Restricted session** | A JWT for an auto-provisioned customer: can view/claim the booking, but cannot confirm credit until OTP step-up. |

---

## 5. Target architecture

```
HOST PAGE                                   BNPL (Vercel frontend + Node API)
┌────────────────────────────┐
│ Host booking form          │
│   └─ submit ───────────────┼──(S2S, x-bnpl-<op>-api-key)──► POST /host/bookings
│                            │ ◄──── { handoffToken } ───────────────────────┘
│                            │
│  BNPL.open(handoffToken)   │        (bnpl-embed.js SDK, versioned /embed/v1)
│   ┌──────────────────────┐ │
│   │ MODAL OVERLAY        │ │
│   │  ┌─────────────────┐ │ │
│   │  │ iframe /embed   │─┼─┼──(exchange)──► POST /host/session/exchange
│   │  │ BNPL↔API↔DB      │ │ │ ◄──── { authToken (JWT), booking, needsOtp } ─┘
│   │  │                 │─┼─┼──(Bearer JWT)─► /api/customer/... (claim, checkout)
│   │  │  [OTP if needed] │ │ │
│   │  └─────────────────┘ │ │
│   └──────────────────────┘ │
│   ◄── postMessage(success) ┘
└────────────────────────────┘
```

---

## 6. End-to-end flow

1. **Host server** calls `POST /host/bookings` with its per-operator API key and the
   canonical booking payload. BNPL creates/reuses the `HostBookingIntent` and mints a
   **handoff token** bound to `{ intentId, operatorId, customerEmail, exp: now+3min, singleUse }`.
   Returns `{ handoffToken, expiresAt }` (no intent token to the browser).
2. **Host page** renders the SDK snippet with `handoffToken` and calls `BNPL.open(...)`.
3. **SDK** builds the modal (overlay + iframe → `/embed?ht=<handoffToken>`), sets a
   loading state, and starts the postMessage handshake.
4. **iframe** calls `POST /host/session/exchange { handoffToken }`. BNPL:
   - validates (unexpired, unused, operator active, request origin ∈ operator
     `allowedOrigins`),
   - **auto-provisions** the `CUSTOMER` by email if absent
     (`provisionedVia: HOST`, `operatorUserStatus/customerStatus: RESTRICTED`),
   - **claims the intent** → real `Booking` (reuse `claimHostBookingIntent` logic),
   - returns `{ authToken (short-TTL JWT), booking, needsOtp }`.
5. **iframe** stores the JWT **in memory** and renders the booking/checkout screens.
6. **If `needsOtp`** (first use / unverified), the modal shows an OTP step before the
   customer can confirm BNPL credit terms. Verified/returning customers skip it.
7. On completion the iframe `postMessage('bnpl:success', { bookingCode })`; the SDK
   fires `onSuccess`; the host navigates to its thank-you page.

---

## 7. Data model changes (Prisma)

**`Operator`** — add:
```prisma
apiKeyHash          String?    // sha-256 of the active key; key shown once at creation/rotation
apiKeyPrefix        String?    // masked display, e.g. "bnpl_live_ab12…7f90"
apiKeyRotatedAt     DateTime?
allowedOrigins      String[]   // e.g. ["https://gocar.example.com"] for frame-ancestors + postMessage
```
> Optional: a dedicated `OperatorApiKey` table if you want multiple concurrent keys /
> rotation-with-grace. Start with a single active key on `Operator`.

**`HostBookingIntent`** — add handoff fields (or a small `HostHandoffToken` table):
```prisma
handoffTokenHash    String?
handoffExpiresAt    DateTime?
handoffUsedAt       DateTime?
```

**`User`** (customer) — add:
```prisma
provisionedVia      String?    // "HOST" for auto-provisioned customers
customerStatus      String?    // "RESTRICTED" until OTP step-up completes, then "ACTIVE"
```

---

## 8. API changes (backend)

| Endpoint | Change |
|---|---|
| `POST /host/bookings` | Look up operator by **API key hash** (replaces global `HOST_API_KEY` compare at `host_controller.js:201-211`). Mint + return **handoff token** instead of register/login URLs. |
| `POST /host/session/exchange` | **New.** Validate handoff → provision `RESTRICTED` customer → claim intent → issue short-TTL JWT. Rate-limited. Origin-checked against operator `allowedOrigins`. |
| `POST /host/session/otp/request` | **New.** Send OTP to the customer's email/phone for the restricted session. |
| `POST /host/session/otp/verify` | **New.** Verify OTP → promote session to `ACTIVE`, clears `needsOtp`. |
| CORS (`app.js:86`) | Make the allowlist **DB-driven** from operator `allowedOrigins` rather than the hardcoded array. |
| Frame headers | Not on the Node app (it doesn't serve the embed). See §9. |

**API key lookup note:** hash the incoming `x-bnpl-*-api-key` and match `Operator.apiKeyHash`;
reject if operator `status !== ACTIVE`. Keep the global `HOST_API_KEY` as a temporary
fallback during migration, then remove.

---

## 9. Frontend changes (BNPL React on Vercel)

- **`/embed` route + shell**: reads `ht`, calls `/host/session/exchange`, stores JWT in
  an `EmbedAuthContext` (**memory only**).
- **Storage partitioning**: third-party iframes get partitioned/blocked
  `localStorage`/`sessionStorage` (see `frontend/src/utils/session.js`). In embed mode the
  api service must read the token from context, **not** `getToken()`. Do not rely on
  persistent storage inside the iframe; use the Storage Access API only if persistence is
  explicitly needed.
- **postMessage**: emit `bnpl:ready`, `bnpl:resize` (via `ResizeObserver`),
  `bnpl:success`, `bnpl:cancel`, `bnpl:error`. Pin the parent origin (validate against the
  operator's registered origin passed in the exchange response).
- **OTP UI**: a step shown when `needsOtp` is true.
- **Reuse** existing booking-details/checkout screens inside the embed layout.

**Framing permission** (Vercel `vercel.json`): serve the `/embed` route with
`Content-Security-Policy: frame-ancestors <operator origins>` and **no**
`X-Frame-Options: DENY`. Allowlist is per-operator, never `*`.

---

## 10. The reusable embed SDK (host-agnostic)

Hosted at `https://<bnpl-frontend>/embed/v1/bnpl-embed.js`. Any host integrates with:

```html
<script src="https://<bnpl-frontend>/embed/v1/bnpl-embed.js"></script>
<script>
  BNPL.open({
    handoffToken: "<%= handoffToken %>",              // from the host's server call
    onSuccess: (b) => location = "/thank_you?ref=" + b.bookingCode,
    onClose:   () => {/* customer dismissed */},
    onError:   (e) => {/* show fallback message */}
  });
</script>
```

The SDK owns: overlay + centered iframe (desktop) / full-screen sheet (mobile), focus
trap, `Esc`/close handling, loading state, and the postMessage protocol below.

### postMessage protocol (versioned)

| Message | Direction | Purpose |
|---|---|---|
| `bnpl:ready` | iframe → host | hide spinner |
| `bnpl:resize` | iframe → host | desktop height sync |
| `bnpl:success` | iframe → host | booking claimed → `onSuccess(booking)` |
| `bnpl:cancel` | iframe → host | user closed → `onClose()` |
| `bnpl:error` | iframe → host | `onError(error)` |

Both sides **pin origins**; the iframe never posts to `"*"`.

### Canonical booking payload (host → `POST /host/bookings`)

Required: `operatorCode`, `hostBookingRef`, `customerName`, `customerEmail`,
`serviceName`, `totalAmount`, plus pickup/return date-times. The controller already
accepts many field-name aliases (`host_controller.js:213-271`), so heterogeneous hosts
map in with minimal friction. Document the canonical names and treat aliases as
compatibility shims.

---

## 11. API key provisioning — Hybrid (Stripe-style)

**Rationale:** BNPL is a credit product; each operator carries financial risk, so keys
must sit behind a vetting/contract gate — no open public key generator. But rotation
shouldn't be a support ticket, so operators self-serve the key **lifecycle** after
onboarding.

**Onboarding (admin gate).** The `MASTER_SELLER` creates the operator via the existing
`POST /operators` flow (`operator_controller.js:281`). Extend it to **auto-generate the
first API key**, store only its hash + masked prefix, and surface the full key once to
the OWNER (in-dashboard reveal, not email).

**Self-serve (owner dashboard module).** Add an **"Integration / API Keys"** module to
the existing owner-only settings area (`/operators/settings`, `ownerOnlyAccess`):
- **View** masked key (prefix + last4) and status.
- **Rotate/regenerate** (full key shown once; old key optionally valid for a short grace).
- **Revoke**.
- **Register allowed origins** (drives `frame-ancestors` + postMessage validation).
- **Copy the SDK snippet** pre-filled with the operator's code.

**Key handling rules**
- Generate high-entropy keys (e.g. `bnpl_live_<32+ bytes base62>`).
- Store **hash only**; show full value exactly once (creation + each rotation).
- All key events audited via the existing `auditLog`.

**Deferred — public self-registration (future phase).** A public signup page may create a
`PENDING` operator that a `MASTER_SELLER` approves before keys activate — never an instant
live key. Not in scope now.

---

## 12. Security model

- **Handoff token**: single-use, ≤3 min TTL, hashed at rest, bound to operator + email +
  intent.
- **Restricted session + OTP step-up**: auto-issued JWT can view/claim only; OTP
  (email/phone) required before confirming credit terms. Returning verified customers skip
  it.
- **Per-operator `frame-ancestors`** — never `*`.
- **postMessage origin pinning** both directions; validate parent origin against operator
  `allowedOrigins`.
- **API key** stays server-side; per-operator; rotate-able; hash-at-rest.
- **Rate limiting** on `exchange` and `otp/*` endpoints.
- **Audit** every exchange, provision, OTP, and key event.

---

## 13. Multi-host future-proofing

- **Operator registry** is the single source of truth: per-host key hash, allowed origins,
  branding/config.
- **DB-driven** CORS + `frame-ancestors` (no hardcoded origin arrays).
- **Versioned** SDK (`/embed/v1/`) and postMessage schema so hosts don't break on changes.
- **Documented canonical payload** + alias shims for heterogeneous hosts.
- **Onboarding = data + snippet**, no code: create operator → key + origins → drop-in SDK.

---

## 14. Phased rollout

| Phase | Scope |
|---|---|
| **1 — Multi-tenant foundation** | `Operator.apiKeyHash`/`apiKeyPrefix`/`allowedOrigins`; key-hash lookup replacing global `HOST_API_KEY`; DB-driven CORS + Vercel `frame-ancestors`. *(Critical-path blocker.)* |
| **2 — Handoff + exchange + OTP** | Handoff token fields; `POST /host/session/exchange`; auto-provision `RESTRICTED` customer; OTP request/verify; short-TTL JWT. |
| **3 — Modal SDK** | `bnpl-embed.js` (`/embed/v1/`), `/embed` route + in-memory auth, postMessage protocol; GoCar swaps `window.open` → `BNPL.open()`. |
| **4 — Provisioning UX + docs** | Owner dashboard "Integration / API Keys" module; admin key auto-gen on operator creation; integration guide + canonical payload doc. |
| **(Future)** | Public operator self-registration with `PENDING` → approval. |

---

## 15. Open questions

1. **OTP channel**: email only first, or email + SMS? (Affects provider/cost.)
2. **Key rotation grace**: instant cutover, or overlap window for the old key?
3. **Restricted-session scope**: exact list of actions allowed before OTP.
4. **Modal vs. full-screen breakpoint** for mobile.
5. **Intent reuse**: keep current "reuse pending intent / existing booking" behavior
   (`host_controller.js:312-368`) under the handoff model — confirm handoff minting on
   reuse paths.

---

## Appendix A — Files touched (indicative)

**Backend**
- `prisma/schema.prisma` — Operator / HostBookingIntent / User fields
- `src/controllers/host_controller.js` — key-hash lookup, handoff mint, exchange, OTP
- `src/routes/host_routes.js` — new session/OTP routes
- `src/controllers/operator_controller.js` — key auto-gen on create; key rotate/revoke
- `src/routes/operator_routes.js` — owner-only key management routes
- `src/app.js` — DB-driven CORS

**Frontend (BNPL)**
- `src/pages/embed/*` — `/embed` shell + OTP UI
- `src/context/EmbedAuthContext` — in-memory JWT
- `src/services/api.js` — token source in embed mode
- `public/embed/v1/bnpl-embed.js` — SDK
- `src/pages/operator/OperatorSettings.jsx` — Integration / API Keys module
- `vercel.json` — `frame-ancestors`

**Host (per host, minimal)**
- Server: `POST /host/bookings` with per-op key → get `handoffToken`
- Page: drop-in SDK snippet + `BNPL.open()`
