---
paths:
  - "src/web/**"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Frontend

One React application with route-level code splitting by role, covering
customer, operator and admin surfaces.

> Code splitting is a bundle size measure, **not** a security boundary. An
> admin chunk that is not loaded by default is still served from the same
> origin and can be fetched by anyone who knows the path. Access control is
> enforced entirely on the server.

## Rules

- Never compute or send a price from the client. The server calculates from
  `rate_rules` at booking time.
- Show the **full payment schedule** with every due date before submission. A
  customer must never be surprised by a second deadline.
- Where the exposure cap blocks a booking, explain it before the form is filled
  in, not at submission.
- Branch on error `code`, never on `message`.
- Features behind a flag check the flag for both the route and the UI element.
- The review section renders only when the review display flag is enabled.
