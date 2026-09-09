# Module boundaries

Twelve domain modules in three tiers, with a thin orchestration layer above.
Full detail and the table-ownership map: `docs/srs/06-system-architecture.md`
section 6.2.

## Tiers

- **Tier 0 Orchestration** — owns transactions, may call any module.
  `BookingCreation`, `PaymentSettled`, `BookingTerminal`, `PayoutRun`.
- **Tier 2b** Booking, Payment, Settlement, Chatbot
- **Tier 2a** Catalogue, Inventory, Promotion, Risk
- **Tier 1 Foundation** Platform, Identity, Compliance, Notification

## The five rules

1. One table, one owner. Only the owning module reads or writes it directly.
2. Cross-module access goes through the owner's service interface. If Risk
   needs booking data it calls a Booking service function; it never issues a
   Prisma query against `bookings`.
3. Cross-module writes happen only inside a Tier 0 orchestrator. A domain
   module never calls another domain module's write method.
4. Reads travel downward only: Tier 2c -> 2b -> 2a -> Tier 1. A read that needs
   to travel upward means the orchestrator should have passed the data in.
5. Within a module: route, then service, then data access.

## Why orchestration rather than direct calls

An earlier design put Risk at the bottom of a strict chain. That cannot be
implemented: Booking needs Risk before a booking exists, Risk needs booking
outcomes, and the credit tier writes into Payment's table. Three of twelve
modules would be in a dependency cycle on day one.

Downward synchronous calls are queries against policy. Upward flow is
asynchronous events through `job_queue`. Risk therefore never reads the
`bookings` table at all, and its counters are maintained incrementally from
events rather than by scanning orders.

## When you think you need an exception

You have found a missing service function, not a shortcut. Raise it.
