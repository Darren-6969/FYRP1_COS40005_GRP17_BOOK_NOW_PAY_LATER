import { processJobs, setDrainHook } from "../services/job_queue_service.js";
import { JOB_HANDLERS } from "../services/job_handlers.js";

// FR-ARCH-001: the single worker that drains job_queue. It runs in-process
// (ADR-04). Handlers are idempotent, so a restart that leaves a job half done
// only means it is picked up again when its lease expires.

const BATCH_SIZE = 10;
let running = false;

// Runs batches until the queue has no more work that is due. One at a time per
// process; a second request while it is running is a no-op because the running
// loop will see the new rows.
export async function runJobQueue({ handlers = JOB_HANDLERS, process = processJobs } = {}) {
  if (running) return { skipped: true };
  running = true;

  const total = { claimed: 0, completed: 0, retried: 0, failed: 0 };
  try {
    for (let round = 0; round < 50; round += 1) {
      const result = await process({ handlers, limit: BATCH_SIZE });
      for (const key of Object.keys(total)) total[key] += result[key] || 0;
      if (result.claimed < BATCH_SIZE) break;
    }
  } finally {
    running = false;
  }
  return total;
}

// Asked for after something is enqueued, so events are recorded within moments
// rather than at the next poll. Never throws and never waits for the drain.
let drainQueued = false;

export function drainSoon() {
  if (drainQueued) return;
  drainQueued = true;
  setTimeout(async () => {
    drainQueued = false;
    try {
      await runJobQueue();
    } catch (error) {
      console.error("[JobQueue] Drain failed:", error.message);
    }
  }, 250);
}

setDrainHook(drainSoon);

export function startJobQueueWorker({ intervalMs = 5000 } = {}) {
  const timer = setInterval(async () => {
    try {
      const result = await runJobQueue();
      if (result.failed) console.error(`[JobQueue] ${result.failed} job(s) moved to failed`);
    } catch (error) {
      console.error("[JobQueue] Worker pass failed:", error.message);
    }
  }, intervalMs);

  // Do not keep the process alive just for the poll.
  timer.unref?.();
  console.log(`[JobQueue] Worker started (every ${intervalMs / 1000}s)`);
  return timer;
}
