import { buildPilotMetrics } from "../services/pilot_metrics_service.js";

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function getPilotMetrics(req, res, next) {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const defaultTo = today.toISOString().slice(0, 10);
    const defaultFromDate = new Date(today);
    defaultFromDate.setUTCDate(today.getUTCDate() - 6);
    const fromValue = req.query.from || defaultFromDate.toISOString().slice(0, 10);
    const toValue = req.query.to || defaultTo;
    const from = parseDate(fromValue);
    const to = parseDate(toValue);

    if (!from || !to || to < from) {
      return res.status(400).json({ message: "Choose a valid date range." });
    }
    if ((to.getTime() - from.getTime()) / 86400000 > 365) {
      return res.status(400).json({ message: "Pilot metrics are limited to 366 days per report." });
    }
    if (to > today) {
      return res.status(400).json({ message: "The report end date cannot be in the future." });
    }

    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    res.json(await buildPilotMetrics({ from, toExclusive }));
  } catch (err) {
    next(err);
  }
}