import test from "node:test";
import assert from "node:assert/strict";
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  backoffMs,
  claimJobs,
  enqueueJob,
  getQueueOverview,
  processJobs,
} from "../../src/services/job_queue_service.js";

const T0 = new Date("2026-10-12T02:00:00Z");
const after = (ms, from = T0) => new Date(from.getTime() + ms);
const MINUTE = 60_000;

// An in-memory job_queue, with a claim that follows the statement in the SRS:
// pending jobs that are due, or processing jobs whose lease has expired, oldest
// first, a lease taken on each, and an expired lease counted as an attempt.
function makeQueue() {
  const rows = [];
  let nextId = 0;

  const database = {
    rows,
    jobQueue: {
      create: async ({ data }) => {
        nextId += 1;
        const row = {
          id: nextId,
          status: "PENDING",
          retryCount: 0,
          claimedAt: null,
          leaseExpiresAt: null,
          errorMessage: null,
          completedAt: null,
          createdAt: new Date(T0.getTime() + nextId),
          nextRetryAt: data.nextRetryAt ?? new Date(0),
          jobType: data.jobType,
          payload: data.payload,
        };
        rows.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const matched = rows.filter((row) => row.id === where.id && (!where.status || row.status === where.status));
        matched.forEach((row) => Object.assign(row, data));
        return { count: matched.length };
      },
      groupBy: async () => {
        const counts = new Map();
        rows.forEach((row) => counts.set(row.status, (counts.get(row.status) || 0) + 1));
        return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
      },
      findMany: async ({ where, take }) =>
        rows.filter((row) => row.status === where.status).slice(0, take).map((row) => ({ ...row })),
    },
  };

  const claim = async ({ limit = 10, now = T0 }) => {
    const due = rows
      .filter(
        (row) =>
          (row.status === "PENDING" && row.nextRetryAt <= now)
          || (row.status === "PROCESSING" && row.leaseExpiresAt < now)
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);

    for (const row of due) {
      if (row.status === "PROCESSING") row.retryCount += 1;
      row.status = "PROCESSING";
      row.claimedAt = now;
      row.leaseExpiresAt = after(LEASE_MS, now);
    }
    return due.map((row) => ({ ...row }));
  };

  return { database, rows, claim };
}

test("retries back off exponentially: 10s, 20s, 40s, 80s", () => {
  assert.deepEqual([1, 2, 3, 4].map(backoffMs), [10_000, 20_000, 40_000, 80_000]);
  assert.equal(MAX_ATTEMPTS, 5);
});

test("enqueueJob writes a durable row, due immediately unless a time is given", async () => {
  const { database, rows } = makeQueue();
  await enqueueJob({ jobType: "analytics_event", payload: { a: 1 }, database });
  await enqueueJob({ jobType: "analytics_event", payload: { b: 2 }, runAt: after(MINUTE), database });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "PENDING");
  assert.equal(rows[1].nextRetryAt.getTime(), after(MINUTE).getTime());
});

test("jobs are claimed with a single statement that skips rows another worker holds", async () => {
  let captured;
  const database = {
    $queryRaw: async (strings, ...values) => {
      captured = { sql: strings.join("?").replace(/\s+/g, " "), values };
      return [];
    },
  };

  await claimJobs({ limit: 7, now: T0, database });

  assert.match(captured.sql, /UPDATE "job_queue"/);
  assert.match(captured.sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(captured.sql, /"status" = 'PENDING'::"JobStatus" AND "nextRetryAt" <= /);
  assert.match(captured.sql, /"status" = 'PROCESSING'::"JobStatus" AND "leaseExpiresAt" < /);
  assert.match(captured.sql, /RETURNING \*/);
  // The values are the time, the lease expiry (five minutes on), the time again and the limit.
  assert.equal(captured.values.some((value) => value instanceof Date && value.getTime() === after(LEASE_MS).getTime()), true);
  assert.equal(captured.values.at(-1), 7);
});

test("a successful job is marked completed", async () => {
  const { database, rows, claim } = makeQueue();
  await enqueueJob({ jobType: "analytics_event", payload: { n: 1 }, runAt: T0, database });
  const seen = [];

  const result = await processJobs({
    handlers: { analytics_event: async (payload) => seen.push(payload) },
    database,
    claim,
    now: T0,
  });

  assert.deepEqual(result, { claimed: 1, completed: 1, retried: 0, failed: 0 });
  assert.deepEqual(seen, [{ n: 1 }]);
  assert.equal(rows[0].status, "COMPLETED");
  assert.ok(rows[0].completedAt);
  assert.equal(rows[0].leaseExpiresAt, null);
});

test("a failing job is retried with backoff and moves to failed on the fifth failure", async () => {
  const { database, rows, claim } = makeQueue();
  await enqueueJob({ jobType: "analytics_event", payload: {}, runAt: T0, database });
  let calls = 0;
  const handlers = {
    analytics_event: async () => {
      calls += 1;
      throw new Error(`boom ${calls}`);
    },
  };

  let now = T0;
  const seenStatus = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await processJobs({ handlers, database, claim, now });
    seenStatus.push([rows[0].status, rows[0].retryCount]);
    // Not due again until its backoff has passed.
    if (attempt < MAX_ATTEMPTS) {
      const early = await processJobs({ handlers, database, claim, now: after(backoffMs(attempt) - 1, now) });
      assert.equal(early.claimed, 0, `attempt ${attempt}: not due before its backoff`);
      now = after(backoffMs(attempt) + 1, now);
    }
  }

  assert.deepEqual(seenStatus.map(([status]) => status), ["PENDING", "PENDING", "PENDING", "PENDING", "FAILED"]);
  assert.deepEqual(seenStatus.map(([, retries]) => retries), [1, 2, 3, 4, 5]);
  assert.equal(rows[0].errorMessage, "boom 5");
  assert.equal(calls, 5);

  // Failed stays failed: it is not retried indefinitely.
  const later = await processJobs({ handlers, database, claim, now: after(24 * 60 * MINUTE, now) });
  assert.equal(later.claimed, 0);
  assert.equal(calls, 5);

  // And it is visible to an administrator.
  const overview = await getQueueOverview({ database });
  assert.equal(overview.counts.FAILED, 1);
  assert.equal(overview.failed[0].errorMessage, "boom 5");
});

test("a job type with no handler fails at once instead of being retried forever", async () => {
  const { database, rows, claim } = makeQueue();
  await enqueueJob({ jobType: "mystery", payload: {}, runAt: T0, database });

  const result = await processJobs({ handlers: {}, database, claim, now: T0 });

  assert.equal(result.failed, 1);
  assert.equal(rows[0].status, "FAILED");
  assert.match(rows[0].errorMessage, /No handler is registered for job type "mystery"/);
});

test("a job that keeps outliving its lease is failed rather than run again", async () => {
  const { database, rows, claim } = makeQueue();
  await enqueueJob({ jobType: "analytics_event", payload: {}, runAt: T0, database });
  let runs = 0;
  const handlers = { analytics_event: async () => { runs += 1; } };

  // A worker claims it and dies, five times over.
  let now = T0;
  for (let i = 0; i < MAX_ATTEMPTS + 1; i += 1) {
    await claim({ now });
    now = after(LEASE_MS + 1, now);
  }
  assert.equal(rows[0].retryCount, MAX_ATTEMPTS);

  const result = await processJobs({ handlers, database, claim, now });
  assert.equal(result.failed, 1);
  assert.equal(runs, 0);
  assert.match(rows[0].errorMessage, /lease expired too many times/);
});

test("50 jobs survive a worker being killed mid-run: each completes exactly once", async () => {
  const { database, rows, claim } = makeQueue();
  for (let i = 1; i <= 50; i += 1) {
    await enqueueJob({ jobType: "notification_send", payload: { id: i }, runAt: T0, database });
  }

  // The effect of a job, guarded the way every handler must be (idempotent).
  const delivered = new Map();
  const handlers = {
    notification_send: async (payload) => {
      if (delivered.has(payload.id)) return; // already done: a re-run changes nothing
      delivered.set(payload.id, (delivered.get(payload.id) || 0) + 1);
    },
  };

  // Worker 1 claims ten jobs and is killed before finishing any of them.
  const killed = await claim({ limit: 10, now: T0 });
  assert.equal(killed.length, 10);

  // Worker 2 drains what it can while those leases are still held.
  let now = after(MINUTE);
  let drained;
  do {
    drained = await processJobs({ handlers, database, claim, now, limit: 10 });
  } while (drained.claimed > 0);
  assert.equal(delivered.size, 40, "the ten leased jobs are not stolen early");
  assert.equal(rows.filter((row) => row.status === "PROCESSING").length, 10);

  // After the leases expire the worker restarts and picks up the stranded jobs.
  now = after(LEASE_MS + MINUTE);
  do {
    drained = await processJobs({ handlers, database, claim, now, limit: 10 });
  } while (drained.claimed > 0);

  assert.equal(rows.every((row) => row.status === "COMPLETED"), true);
  assert.equal(delivered.size, 50);
  assert.equal([...delivered.values()].every((count) => count === 1), true, "no duplicate effect");
  assert.equal(rows.filter((row) => row.retryCount === 1).length, 10, "the reclaimed jobs count one lost lease");
});
