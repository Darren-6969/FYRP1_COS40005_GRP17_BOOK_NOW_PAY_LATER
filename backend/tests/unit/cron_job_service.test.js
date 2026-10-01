import { test } from "node:test";
import assert from "node:assert/strict";
import { runLoggedCronJob } from "../../src/services/cron_job_service.js";

function createLockingDatabase() {
  let lockHeld = false;
  let nextId = 1;
  const logs = [];

  return {
    logs,
    async $transaction(callback) {
      let acquired = false;
      const tx = {
        $queryRaw: async () => {
          acquired = !lockHeld;
          if (acquired) lockHeld = true;
          return [{ acquired }];
        },
      };

      try {
        return await callback(tx);
      } finally {
        if (acquired) lockHeld = false;
      }
    },
    cronJobLog: {
      create: async ({ data }) => {
        const log = { id: nextId++, ...data };
        logs.push(log);
        return log;
      },
      update: async ({ where, data }) => {
        const log = logs.find((entry) => entry.id === where.id);
        Object.assign(log, data);
        return log;
      },
    },
  };
}

test("only the advisory-lock holder executes and both attempts are logged", async () => {
  const database = createLockingDatabase();
  let releaseFirst;
  let signalFirstStarted;
  const firstStarted = new Promise((resolve) => {
    signalFirstStarted = resolve;
  });
  const holdFirst = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let executions = 0;

  const firstRun = runLoggedCronJob(
    "OVERDUE_CHECK",
    async () => {
      executions += 1;
      signalFirstStarted();
      await holdFirst;
      return { expiredCount: 2 };
    },
    { database }
  );
  await firstStarted;

  const secondResult = await runLoggedCronJob(
    "OVERDUE_CHECK",
    async () => {
      executions += 1;
    },
    { database }
  );

  releaseFirst();
  await firstRun;

  assert.equal(executions, 1);
  assert.deepEqual(secondResult, { skipped: true, jobName: "OVERDUE_CHECK" });
  assert.equal(database.logs.length, 2);
  assert.equal(database.logs[0].processedCount, 2);
  assert.equal(database.logs[0].status, "SUCCESS");
  assert.equal(database.logs[1].status, "SKIPPED");
  assert.ok(database.logs.every((log) => log.startedAt && log.endedAt));
});

test("logs failures and their errors before rethrowing", async () => {
  const database = createLockingDatabase();

  await assert.rejects(
    runLoggedCronJob("BROKEN_JOB", async () => {
      throw new Error("database unavailable");
    }, { database }),
    /database unavailable/
  );

  assert.equal(database.logs[0].status, "FAILED");
  assert.equal(database.logs[0].failureCount, 1);
  assert.deepEqual(database.logs[0].errors, [{ message: "database unavailable" }]);
  assert.ok(database.logs[0].endedAt);
});