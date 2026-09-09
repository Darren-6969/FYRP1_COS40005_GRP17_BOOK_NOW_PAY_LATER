---
paths:
  - "src/jobs/**"
  - "src/worker/**"
  - "src/modules/platform/**"
  - "src/modules/notification/**"
---

# Background jobs and the outbox

Spec: `docs/srs/06-system-architecture.md` 6.3.2 and 6.3.3.

## One queue, one purpose

`job_queue` is both the job queue and the outbox. There is no separate outbox
table: both are durable rows written inside a business transaction and drained
by a worker, and maintaining two would mean two retry policies and a recurring
argument about which one a task belongs in.

Outbound work is enqueued **inside the same transaction** as the business data
that triggered it. Commit the booking, commit the email. Never send from inside
a request handler.

## Claiming

```sql
UPDATE job_queue SET status='processing',
       claimed_at=now(), lease_expires_at=now() + interval '5 minutes'
 WHERE id IN (
   SELECT id FROM job_queue
    WHERE (status='pending' AND next_retry_at <= now())
       OR (status='processing' AND lease_expires_at < now())
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED LIMIT 10
 ) RETURNING *;
```

The lease is what makes a crashed or redeployed worker safe. Without it,
`processing` rows strand forever.

## Rules

- **Every handler must be idempotent.** A lease expiry can cause a job to run
  twice. The notification handler checks `notification_logs` before sending.
- After five failures a job moves to `failed` and appears in the admin queue.
  A `failed` row nobody looks at is an undelivered notification the team
  believes was sent.
- The worker is a separate entry point (`src/worker/index.js`) sharing this
  codebase, deployed in-process. Keeping the entry point separate means
  extracting it later is a deployment change, not a refactor. Never bury a
  `setInterval` in `server.js`.
- Scheduled jobs take a Postgres advisory lock before running. Cron is
  scheduled against Malaysia time.
