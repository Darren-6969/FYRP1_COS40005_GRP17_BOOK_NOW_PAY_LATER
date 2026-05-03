import {
  getCronStatus,
  runBookingMaintenanceChecks,
  runCompletedBookingCheck,
  runNoMerchantResponseCheck,
  runOverdueBookingCheck,
  runPaymentReminderCheck,
} from "../services/cron_service.js";

export async function getCronJobStatus(req, res, next) {
  try {
    res.json(getCronStatus());
  } catch (err) {
    next(err);
  }
}

export async function runOverdueCheck(req, res, next) {
  try {
    const result = await runOverdueBookingCheck({
      triggeredByUserId: req.user?.id || null,
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
    const result = await runBookingMaintenanceChecks({
      triggeredByUserId: req.user?.id || null,
    });

    res.json({
      message: "Booking maintenance checks completed",
      result,
    });
  } catch (err) {
    next(err);
  }
}