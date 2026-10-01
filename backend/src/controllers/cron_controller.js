import {
  getCronStatus,
  getCronRunHistory,
  runBookingMaintenanceChecks,
  runCompletedBookingCheck,
  runNoMerchantResponseCheck,
  runOverdueBookingCheck,
  runPaymentReminderCheck,
  runDailyRecoverySweep,
} from "../services/cron_service.js";
import { runIdempotencyCleanupJob } from "../jobs/idempotencyCleanup_job.js";
import { processStripeWebhookEvents } from "../jobs/stripeWebhook_worker.js";

export async function getCronJobStatus(req, res, next) {
  try {
    res.json(getCronStatus());
  } catch (err) {
    next(err);
  }
}

export async function getCronHistory(req, res, next) {
  try {
    const history = await getCronRunHistory({
      jobType: req.query.jobType || "ALL",
      status: req.query.status || "ALL",
      limit: req.query.limit || 30,
    });

    res.json({ history });
  } catch (err) {
    next(err);
  }
}

export async function runOverdueCheck(req, res, next) {
  try {
    const result = await runOverdueBookingCheck({
      triggeredByUserId: req.user?.id || null,
      triggerSource: "MANUAL",
    });

    res.json({
      message: "Overdue booking check completed",
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function runCompletionCheck(req, res, next) {
  try {
    const result = await runCompletedBookingCheck({
      triggeredByUserId: req.user?.id || null,
      triggerSource: "MANUAL",
    });

    res.json({
      message: "Completed booking check completed",
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function runPaymentReminderCron(req, res, next) {
  try {
    const result = await runPaymentReminderCheck({
      triggeredByUserId: req.user?.id || null,
      triggerSource: "MANUAL",
    });

    res.json({
      message: "Payment reminder check completed",
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function runNoResponseCron(req, res, next) {
  try {
    const result = await runNoMerchantResponseCheck({
      triggeredByUserId: req.user?.id || null,
      triggerSource: "MANUAL",
    });

    res.json({
      message: "No merchant response check completed",
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function runMaintenanceChecks(req, res, next) {
  try {
    const webhookResult = req.user ? null : await processStripeWebhookEvents();
    const result = await runBookingMaintenanceChecks({
      triggeredByUserId: req.user?.id || null,
      triggerSource: req.user ? "MANUAL" : "VERCEL_CRON",
    });

    res.json({
      message: "Booking maintenance checks completed",
      result,
      ...(webhookResult ? { webhookResult } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function runIdempotencyCleanup(_req, res, next) {
  try {
    const result = await runIdempotencyCleanupJob();
    const deleted = result?.deleted || 0;
    res.json({ message: "Expired idempotency keys cleaned up", deleted });
  } catch (err) {
    next(err);
  }
}

export async function runStripeWebhookWorker(_req, res, next) {
  try {
    const result = await processStripeWebhookEvents();
    res.json({ message: "Stripe webhook events processed", result });
  } catch (err) {
    next(err);
  }
}

export async function runDailyRecovery(_req, res, next) {
  try {
    const result = await runDailyRecoverySweep();
    res.json({ message: "Daily recovery sweep completed", result });
  } catch (err) {
    next(err);
  }
}