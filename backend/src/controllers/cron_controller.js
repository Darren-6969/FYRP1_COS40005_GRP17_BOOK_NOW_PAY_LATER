import {
  getCronStatus,
  runOverdueBookingCheck,
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