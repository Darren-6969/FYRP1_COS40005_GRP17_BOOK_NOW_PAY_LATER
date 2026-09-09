# BNPL Platform

Car rental and tour package booking platform for Sarawak, built on a
book-now-pay-later model. Customers confirm a booking immediately and pay by a
deadline the platform sets; the operator holds the vehicle or seat meanwhile.

- Full specification: `docs/srs/INDEX.md` (requirement lookup table)
- Current work: `docs/backlog.csv`
- Architecture: `docs/srs/06-system-architecture.md`
- Which document is master for what: `docs/README.md`

Read the SRS section named in a story's `Requirement Ref` before implementing
it. The specification records why each decision was made, and several of the
obvious implementations were considered and deliberately rejected.

## Stack

Node.js + Express (ESM), Prisma, PostgreSQL, React + Vite.

Currently deployed on Vercel. Migrating to DigitalOcean App Platform in week 1
(BNPL-001) — a client requirement, not optional. Write new code against the DO
topology described in `docs/srs/06-system-architecture.md`.

## Non-negotiables

These three would end the pilot if they failed. Nothing justifies weakening them.

1. **No overselling.** Inventory is reserved by a single ranged `UPDATE` with a
   row-count assertion. Never a loop over dates.
2. **No unreconciled money.** All amounts are integers in sen. Commission,
   payment fee and discount are separate ledger columns.
3. **No exposed personal data.** Identity documents live in a private bucket
   behind presigned URLs. Tenant queries go through `withOperatorContext()`.

## Module boundaries

The rule that matters most. Full version in `.claude/rules/module-boundaries.md`.

- One table has exactly one owning module. Only that module queries it.
- Cross-module reads go through the owner's service function.
- Cross-module **writes** happen only inside a Tier 0 orchestrator.
- Never import the raw Prisma client. Use the tenant-aware client.

The CI conformance check is BNPL-006 and is NOT BUILT YET. Until it exists
these rules are unenforced and depend on review. Treat them as binding anyway.
Once it lands: do not disable the check or add an exception without raising it
with the team first.

## Layering

`route -> service -> data access`. Business logic lives only in services.
Controllers validate input and shape responses, nothing else. This is not
stylistic: the Phase 1 codebase put ID coercion in a controller and produced
silent Prisma failures, and let the frontend bypass the payment step.

## Conventions

- Money: integers in sen. Never floats, never `Number` arithmetic on currency.
- Time: `timestamptz` stored UTC. All deadline arithmetic in
  `Asia/Kuala_Lumpur`. `listing_availability.date` is a plain date in operator
  local time. Cron is scheduled against Malaysia time, not UTC.
- Every write endpoint requires an `Idempotency-Key` header.
- Errors return `{ code, message, request_id, details }`. Clients branch on
  `code`, never on `message`. Codes are registered in `src/errors/codes.js`.
- Background work is enqueued to `job_queue` **inside the same transaction** as
  the business data that triggered it. Never fire-and-forget, never a floating
  promise.
- All routes live under `/v1`.

## Commands (today)

Run from `backend/`. There is no root `package.json` yet.

```bash
cd backend && npm run dev
cd backend && npm run test             # unit
cd backend && npm run test:integration # needs a real Postgres; never mock the database
cd backend && npm run lint
npx prisma migrate dev
```

The frontend runs separately: `cd frontend && npm run dev`.

## Commands (from BNPL-004, week 1)

CI adds a root workspace so these run once for both packages:

```bash
npm run test
npm run test:integration
npm run lint             # will include the module boundary check once BNPL-006 lands
```

Do not invent commands that do not exist. If a command in this file fails,
that is a bug in this file — say so rather than working around it.

Integration tests connect as the application role, never a superuser. A
superuser bypasses row-level security and makes the isolation test vacuous.

## Definition of done

1. Every acceptance criterion in the story passes.
2. Unit tests written; integration test added if the story crosses a module.
3. `npm run lint` green, including the boundary conformance check.
4. OpenAPI contract updated if the API changed.
5. Reviewed and approved by one other member.
6. Merged to `staging` and verified there.

Steps 2, 3 and 4 are blocked until BNPL-004 and BNPL-006 land. Until then:
acceptance criteria pass, and one review.

## Working with stories

Prompt shape that works:

> Implement BNPL-043. Acceptance criteria are in `docs/backlog.csv`.
> Read section 4.1.3 in `docs/srs/04-phase-2-platform-requirements.md` first.

One story per session. Close the session when it is done rather than chaining
three stories into one conversation.


## Commit Conventions
- Never add "Co-Authored-By" lines to commits.
- Do not include Claude attribution in commit messages or pull requests.
