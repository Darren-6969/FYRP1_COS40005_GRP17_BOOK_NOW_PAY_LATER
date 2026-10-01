import cron from "node-cron";
import prisma from "../config/db.js";
import { processStripeWebhookEvent } from "../routes/stripe_routes.js";

const STALE_LOCK_MS = 5 * 60 * 1000;
const BATCH_SIZE = 20;

export async function processStripeWebhookEvents() {
  const now = new Date();
  const staleLock = new Date(now.getTime() - STALE_LOCK_MS);
  const events = await prisma.stripeWebhookEvent.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lt: staleLock } },
      ],
    },
    orderBy: { receivedAt: "asc" },
    take: BATCH_SIZE,
  });

  const result = { claimed: 0, processed: 0, failed: 0 };
  for (const event of events) {
    const claim = await prisma.stripeWebhookEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
          { status: "PROCESSING", lockedAt: { lt: staleLock } },
        ],
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: now,
        lastError: null,
      },
    });
    if (!claim.count) continue;
    result.claimed += 1;

    try {
      await processStripeWebhookEvent(event.payload);
      await prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date(), lockedAt: null, lastError: null },
      });
      result.processed += 1;
    } catch (err) {
      const attempts = event.attempts + 1;
      const retryDelayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
      await prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastError: String(err.message || err).slice(0, 2000),
          nextAttemptAt: new Date(Date.now() + retryDelayMinutes * 60 * 1000),
        },
      });
      result.failed += 1;
      console.error(`[StripeWebhookWorker] Event ${event.id} failed:`, err.message);
    }
  }

  return result;
}

export function startStripeWebhookWorker() {
  cron.schedule("* * * * *", async () => {
    try {
      await processStripeWebhookEvents();
    } catch (err) {
      console.error("[StripeWebhookWorker] Poll failed:", err.message);
    }
  });
  console.log("[StripeWebhookWorker] Polling started (every minute)");
}