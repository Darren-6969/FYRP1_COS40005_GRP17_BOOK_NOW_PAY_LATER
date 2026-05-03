import prisma from "../config/db.js";
import ARIMA from "arima";

// Minimum data points required by each model
const SARIMA_MIN = 22; // SARIMA(1,1,1)(1,1,1,7)
const ARIMA_MIN = 12;  // ARIMA(1,1,1)

/**
 * Aggregate daily booking counts and paid revenue for an operator.
 * Returns one entry per calendar day for the last `days` days.
 */
async function getHistoricalData(operatorId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const bookings = await prisma.booking.findMany({
    where: {
      ...(operatorId != null ? { operatorId } : {}),
      createdAt: { gte: since },
    },
    include: { payment: true },
    orderBy: { createdAt: "asc" },
  });

  // Seed every day with zero so the series has no gaps
  const dailyMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = { date: key, bookings: 0, revenue: 0 };
  }

  for (const b of bookings) {
    const key = b.createdAt.toISOString().split("T")[0];
    if (!dailyMap[key]) continue;
    dailyMap[key].bookings += 1;
    if (b.payment?.status === "PAID") {
      dailyMap[key].revenue += Number(b.totalAmount);
    }
  }

  return Object.values(dailyMap);
}

/**
 * Fit the best available model to `series` and return `horizon` forecast steps.
 * Each step: { value, lower, upper } — where lower/upper are 95% CI bounds.
 *
 * Model selection (descending preference):
 *   SARIMA(1,1,1)(1,1,1,7)  — weekly seasonal pattern, ≥ 22 non-zero points
 *   ARIMA(1,1,1)             — trend model,              ≥ 12 non-zero points
 *   Moving average           — fallback for sparse data
 */
function fitForecast(series, horizon) {
  const nonZeroCount = series.filter((v) => v > 0).length;

  // Not enough signal — return flat moving-average projection with wide CI
  if (nonZeroCount < 3) {
    const avg = series.reduce((s, v) => s + v, 0) / Math.max(series.length, 1);
    return Array.from({ length: horizon }, () => ({
      value: avg,
      lower: 0,
      upper: avg * 2 + 1,
    }));
  }

  const useSARIMA = series.length >= SARIMA_MIN && nonZeroCount >= SARIMA_MIN;
  const useARIMA = series.length >= ARIMA_MIN && nonZeroCount >= ARIMA_MIN;

  if (useSARIMA || useARIMA) {
    try {
      const params = useSARIMA
        ? { p: 1, d: 1, q: 1, P: 1, D: 1, Q: 1, s: 7, verbose: false }
        : { p: 1, d: 1, q: 1, verbose: false };

      const model = new ARIMA(params);
      model.train(series);
      const [pred, errors] = model.predict(horizon);

      return pred.map((value, i) => {
        const se = Math.abs(errors[i] || 0);
        return {
          value: Math.max(0, value),
          lower: Math.max(0, value - 1.96 * se),
          upper: Math.max(0, value + 1.96 * se),
        };
      });
    } catch {
      // fall through to moving-average fallback
    }
  }

  // Moving-average fallback
  const window = series.slice(-Math.min(14, series.length));
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  return Array.from({ length: horizon }, () => ({
    value: avg,
    lower: avg * 0.6,
    upper: avg * 1.4 + 1,
  }));
}

/**
 * Generate a 30-day demand forecast for the given operator.
 * Pass `operatorId = null` for a platform-wide (master) view.
 *
 * Returns:
 *   historical   — last 30 days of actual daily booking/revenue data
 *   forecast     — 30 forecast days with CI bounds
 *   summary      — KPI metrics (next 7-day estimates, late-payment risk, model used)
 */
export async function generateForecast(operatorId, horizon = 30) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const operatorFilter = operatorId != null ? { operatorId } : {};

  const [historical, recentTotal, recentOverdue] = await Promise.all([
    getHistoricalData(operatorId, 90),
    prisma.booking.count({
      where: { ...operatorFilter, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.booking.count({
      where: {
        ...operatorFilter,
        createdAt: { gte: thirtyDaysAgo },
        OR: [{ status: "OVERDUE" }, { payment: { status: "OVERDUE" } }],
      },
    }),
  ]);

  const bookingSeries = historical.map((d) => d.bookings);
  const revenueSeries = historical.map((d) => d.revenue);

  const bookingForecast = fitForecast(bookingSeries, horizon);
  const revenueForecast = fitForecast(revenueSeries, horizon);

  const today = new Date();
  const forecastPoints = Array.from({ length: horizon }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    const bp = bookingForecast[i];
    const rp = revenueForecast[i];
    return {
      date: d.toISOString().split("T")[0],
      predictedBookings: Math.round(bp.value * 10) / 10,
      bookingsLower: Math.round(bp.lower * 10) / 10,
      bookingsUpper: Math.round(bp.upper * 10) / 10,
      predictedRevenue: Math.round(rp.value * 100) / 100,
      revenueLower: Math.round(rp.lower * 100) / 100,
      revenueUpper: Math.round(rp.upper * 100) / 100,
    };
  });

  const next7 = forecastPoints.slice(0, 7);
  const nonZeroCount = historical.filter((d) => d.bookings > 0 || d.revenue > 0).length;

  let modelType;
  if (historical.length >= SARIMA_MIN && nonZeroCount >= SARIMA_MIN) {
    modelType = "SARIMA(1,1,1)(1,1,1,7)";
  } else if (nonZeroCount >= ARIMA_MIN) {
    modelType = "ARIMA(1,1,1)";
  } else {
    modelType = "Moving Average";
  }

  return {
    historical: historical.slice(-30),
    forecast: forecastPoints,
    summary: {
      next7DaysRevenue:
        Math.round(next7.reduce((s, p) => s + p.predictedRevenue, 0) * 100) / 100,
      next7DaysBookings: Math.round(
        next7.reduce((s, p) => s + p.predictedBookings, 0)
      ),
      latePaymentRisk: recentTotal
        ? Math.round((recentOverdue / recentTotal) * 100)
        : 0,
      modelType,
      dataPoints: nonZeroCount,
      forecastHorizon: horizon,
    },
  };
}
