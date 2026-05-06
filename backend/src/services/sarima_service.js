import prisma from "../config/db.js";
import ARIMA from "arima";

const SARIMA_MIN = 22;
const ARIMA_MIN = 12;

// ─── Internal helpers ────────────────────────────────────────────────────────

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

function fitForecast(series, horizon) {
  const nonZeroCount = series.filter((v) => v > 0).length;

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
      // fall through
    }
  }

  const window = series.slice(-Math.min(14, series.length));
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  return Array.from({ length: horizon }, () => ({
    value: avg,
    lower: avg * 0.6,
    upper: avg * 1.4 + 1,
  }));
}

function countWeekdayOccurrences(since, days) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    counts[d.getDay()]++;
  }
  return counts;
}

async function getDayOfWeekAverages(operatorId, since, days) {
  const until = new Date(since);
  until.setDate(until.getDate() + days);

  const bookings = await prisma.booking.findMany({
    where: {
      ...(operatorId != null ? { operatorId } : {}),
      createdAt: { gte: since, lt: until },
    },
    select: { createdAt: true },
  });

  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const b of bookings) {
    counts[new Date(b.createdAt).getDay()]++;
  }

  const occurrences = countWeekdayOccurrences(since, days);
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

  return order.map((i) => ({
    day: DAY_SHORT[i],
    fullDay: DAY_FULL[i],
    average: occurrences[i] > 0 ? Math.round((counts[i] / occurrences[i]) * 10) / 10 : 0,
    total: counts[i],
  }));
}

async function getPopularServices(operatorId, since, until) {
  const bookings = await prisma.booking.findMany({
    where: {
      ...(operatorId != null ? { operatorId } : {}),
      createdAt: { gte: since, lt: until },
    },
    select: {
      serviceName: true,
      totalAmount: true,
      payment: { select: { status: true } },
    },
  });

  const total = bookings.length;
  const map = {};

  for (const b of bookings) {
    const name = b.serviceName || "Unknown";
    if (!map[name]) map[name] = { service: name, count: 0, revenue: 0 };
    map[name].count++;
    if (b.payment?.status === "PAID") {
      map[name].revenue += Number(b.totalAmount);
    }
  }

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => ({
      ...s,
      revenue: Math.round(s.revenue * 100) / 100,
      pct: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }));
}

function computeInsights(historical, forecastPoints, dayOfWeekAvg, popularServices, latePaymentRisk) {
  const insights = [];

  const last30 = historical.slice(-30);
  const prev30 = historical.slice(-60, -30);
  const totalLast30 = last30.reduce((s, d) => s + d.bookings, 0);
  const totalPrev30 = prev30.reduce((s, d) => s + d.bookings, 0);

  if (totalPrev30 > 0) {
    const change = Math.round(((totalLast30 - totalPrev30) / totalPrev30) * 100);
    if (change > 0) {
      insights.push({ type: "success", text: `Bookings grew ${change}% compared to the previous 30-day period.` });
    } else if (change < 0) {
      insights.push({ type: "warning", text: `Bookings declined ${Math.abs(change)}% compared to the previous 30-day period.` });
    } else {
      insights.push({ type: "neutral", text: "Booking volume is stable compared to the previous 30-day period." });
    }
  } else if (totalLast30 > 0) {
    insights.push({ type: "info", text: `${totalLast30} bookings recorded in the last 30 days.` });
  }

  const peakDow = dayOfWeekAvg.reduce(
    (best, d) => (d.average > best.average ? d : best),
    dayOfWeekAvg[0] ?? { average: 0, fullDay: "-" }
  );
  if (peakDow.average > 0) {
    insights.push({ type: "info", text: `Peak demand day is ${peakDow.fullDay} with an average of ${peakDow.average} bookings.` });
  }

  const weekendTotal = dayOfWeekAvg
    .filter((d) => ["Sat", "Sun"].includes(d.day))
    .reduce((s, d) => s + d.total, 0);
  const allTotal = dayOfWeekAvg.reduce((s, d) => s + d.total, 0);
  if (allTotal > 0) {
    const weekendPct = Math.round((weekendTotal / allTotal) * 100);
    if (weekendPct >= 50) {
      insights.push({ type: "info", text: `Weekend bookings account for ${weekendPct}% of volume — strong weekend demand.` });
    } else if (weekendPct <= 20 && allTotal > 5) {
      insights.push({ type: "info", text: `Weekday-driven demand: ${100 - weekendPct}% of bookings fall on weekdays.` });
    }
  }

  if (popularServices.length > 0) {
    const best = popularServices[0];
    insights.push({ type: "success", text: `Top service: "${best.service}" with ${best.count} bookings (${best.pct}% of total).` });
  }

  if (forecastPoints.length > 0) {
    const next7 = Math.round(forecastPoints.slice(0, 7).reduce((s, p) => s + p.predictedBookings, 0));
    if (next7 > 0) {
      insights.push({ type: "info", text: `Forecast: ~${next7} bookings expected in the next 7 days.` });
    }
  }

  if (latePaymentRisk >= 30) {
    insights.push({ type: "danger", text: `High late payment risk (${latePaymentRisk}%). Consider proactive payment reminders.` });
  } else if (latePaymentRisk >= 10) {
    insights.push({ type: "warning", text: `Moderate late payment risk (${latePaymentRisk}%). Monitor overdue bookings.` });
  } else if (latePaymentRisk > 0) {
    insights.push({ type: "success", text: `Healthy payment collection — only ${latePaymentRisk}% late payment rate.` });
  }

  return insights;
}

async function getAvailableMonths(operatorId) {
  const oldest = await prisma.booking.findFirst({
    where: operatorId != null ? { operatorId } : {},
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!oldest) return [];

  const months = [];
  const now = new Date();
  let cursor = new Date(
    new Date(oldest.createdAt).getFullYear(),
    new Date(oldest.createdAt).getMonth(),
    1
  );

  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function resolveModelType(seriesLength, nonZeroCount) {
  if (seriesLength >= SARIMA_MIN && nonZeroCount >= SARIMA_MIN) return "SARIMA(1,1,1)(1,1,1,7)";
  if (nonZeroCount >= ARIMA_MIN) return "ARIMA(1,1,1)";
  return "Moving Average";
}

// ─── Exported: legacy forecast used by /reports ──────────────────────────────

export async function generateForecast(operatorId, horizon = 30) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const operatorFilter = operatorId != null ? { operatorId } : {};

  const [historical, recentTotal, recentOverdue] = await Promise.all([
    getHistoricalData(operatorId, 90),
    prisma.booking.count({ where: { ...operatorFilter, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.count({
      where: {
        ...operatorFilter,
        createdAt: { gte: thirtyDaysAgo },
        OR: [{ status: "OVERDUE" }, { payment: { status: "OVERDUE" } }],
      },
    }),
  ]);

  const bookingForecast = fitForecast(historical.map((d) => d.bookings), horizon);
  const revenueForecast = fitForecast(historical.map((d) => d.revenue), horizon);

  const today = new Date();
  const forecastPoints = Array.from({ length: horizon }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().split("T")[0],
      predictedBookings: Math.round(bookingForecast[i].value * 10) / 10,
      bookingsLower: Math.round(bookingForecast[i].lower * 10) / 10,
      bookingsUpper: Math.round(bookingForecast[i].upper * 10) / 10,
      predictedRevenue: Math.round(revenueForecast[i].value * 100) / 100,
      revenueLower: Math.round(revenueForecast[i].lower * 100) / 100,
      revenueUpper: Math.round(revenueForecast[i].upper * 100) / 100,
    };
  });

  const next7 = forecastPoints.slice(0, 7);
  const nonZeroCount = historical.filter((d) => d.bookings > 0 || d.revenue > 0).length;

  return {
    historical: historical.slice(-30),
    forecast: forecastPoints,
    summary: {
      next7DaysRevenue: Math.round(next7.reduce((s, p) => s + p.predictedRevenue, 0) * 100) / 100,
      next7DaysBookings: Math.round(next7.reduce((s, p) => s + p.predictedBookings, 0)),
      latePaymentRisk: recentTotal ? Math.round((recentOverdue / recentTotal) * 100) : 0,
      modelType: resolveModelType(historical.length, nonZeroCount),
      dataPoints: nonZeroCount,
      forecastHorizon: horizon,
    },
  };
}

// ─── Exported: full analytics used by /analytics ─────────────────────────────

export async function generateAnalytics(operatorId, { year, month } = {}) {
  const operatorFilter = operatorId != null ? { operatorId } : {};
  const now = new Date();

  // ── Monthly mode ────────────────────────────────────────────────────────────
  if (year && month) {
    const since = new Date(Date.UTC(year, month - 1, 1));
    const until = new Date(Date.UTC(year, month, 1));
    const isCurrentOrFuture =
      year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1);

    const [monthBookings, dayOfWeekAvg, popularServices, availableMonths] =
      await Promise.all([
        prisma.booking.findMany({
          where: { ...operatorFilter, createdAt: { gte: since, lt: until } },
          include: { payment: true },
          orderBy: { createdAt: "asc" },
        }),
        getDayOfWeekAverages(operatorId, since, new Date(year, month, 0).getDate()),
        getPopularServices(operatorId, since, until),
        getAvailableMonths(operatorId),
      ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, idx) => {
      const dateStr = new Date(Date.UTC(year, month - 1, idx + 1))
        .toISOString()
        .split("T")[0];
      const dayBookings = monthBookings.filter((b) =>
        b.createdAt.toISOString().startsWith(dateStr)
      );
      return {
        date: dateStr,
        bookings: dayBookings.length,
        revenue:
          Math.round(
            dayBookings
              .filter((b) => b.payment?.status === "PAID")
              .reduce((s, b) => s + Number(b.totalAmount), 0) * 100
          ) / 100,
      };
    });

    const paidBookings = monthBookings.filter((b) => b.payment?.status === "PAID");
    const monthlySummary = {
      totalBookings: monthBookings.length,
      paidBookings: paidBookings.length,
      totalRevenue:
        Math.round(paidBookings.reduce((s, b) => s + Number(b.totalAmount), 0) * 100) / 100,
      avgDailyBookings: Math.round((monthBookings.length / daysInMonth) * 10) / 10,
    };

    // Add SARIMA forecast for remaining days of current/future months
    let forecast = [];
    let forecastSummary = null;
    if (isCurrentOrFuture) {
      const historical = await getHistoricalData(operatorId, 90);
      const bFcast = fitForecast(historical.map((d) => d.bookings), 30);
      const rFcast = fitForecast(historical.map((d) => d.revenue), 30);
      const nonZeroCount = historical.filter((d) => d.bookings > 0).length;

      forecast = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() + i + 1);
        if (d >= until) return null;
        return {
          date: d.toISOString().split("T")[0],
          predictedBookings: Math.round(bFcast[i].value * 10) / 10,
          bookingsLower: Math.round(bFcast[i].lower * 10) / 10,
          bookingsUpper: Math.round(bFcast[i].upper * 10) / 10,
          predictedRevenue: Math.round(rFcast[i].value * 100) / 100,
          revenueLower: Math.round(rFcast[i].lower * 100) / 100,
          revenueUpper: Math.round(rFcast[i].upper * 100) / 100,
        };
      }).filter(Boolean);

      if (forecast.length > 0) {
        const peak = forecast.reduce(
          (best, p) => (p.predictedBookings > best.predictedBookings ? p : best),
          forecast[0]
        );
        forecastSummary = {
          expectedBookings: Math.round(forecast.reduce((s, p) => s + p.predictedBookings, 0)),
          expectedRevenue:
            Math.round(forecast.reduce((s, p) => s + p.predictedRevenue, 0) * 100) / 100,
          peakDemandDay: new Date(peak.date).toLocaleDateString("en-MY", { weekday: "long" }),
          peakDemandDate: peak.date,
          modelType: resolveModelType(historical.length, nonZeroCount),
          dataPoints: nonZeroCount,
        };
      }
    }

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-MY", {
      month: "long",
      year: "numeric",
    });

    return {
      mode: "monthly",
      period: { year, month, label: monthLabel },
      historical: dailyData,
      forecast,
      dayOfWeekAverage: dayOfWeekAvg,
      forecastSummary,
      monthlySummary,
      demandInsights: computeInsights(dailyData, forecast, dayOfWeekAvg, popularServices, 0),
      popularServices,
      availableMonths,
    };
  }

  // ── Dashboard mode (default) ────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const horizon = 30;

  const [historical, dayOfWeekAvg, popularServices, recentTotal, recentOverdue, availableMonths] =
    await Promise.all([
      getHistoricalData(operatorId, 90),
      getDayOfWeekAverages(operatorId, ninetyDaysAgo, 90),
      getPopularServices(operatorId, thirtyDaysAgo, now),
      prisma.booking.count({ where: { ...operatorFilter, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.booking.count({
        where: {
          ...operatorFilter,
          createdAt: { gte: thirtyDaysAgo },
          OR: [{ status: "OVERDUE" }, { payment: { status: "OVERDUE" } }],
        },
      }),
      getAvailableMonths(operatorId),
    ]);

  const nonZeroCount = historical.filter((d) => d.bookings > 0).length;
  const bFcast = fitForecast(historical.map((d) => d.bookings), horizon);
  const rFcast = fitForecast(historical.map((d) => d.revenue), horizon);

  const forecastPoints = Array.from({ length: horizon }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().split("T")[0],
      predictedBookings: Math.round(bFcast[i].value * 10) / 10,
      bookingsLower: Math.round(bFcast[i].lower * 10) / 10,
      bookingsUpper: Math.round(bFcast[i].upper * 10) / 10,
      predictedRevenue: Math.round(rFcast[i].value * 100) / 100,
      revenueLower: Math.round(rFcast[i].lower * 100) / 100,
      revenueUpper: Math.round(rFcast[i].upper * 100) / 100,
    };
  });

  const latePaymentRisk = recentTotal ? Math.round((recentOverdue / recentTotal) * 100) : 0;
  const peak = forecastPoints.reduce(
    (best, p) => (p.predictedBookings > best.predictedBookings ? p : best),
    forecastPoints[0]
  );

  return {
    mode: "dashboard",
    period: null,
    historical: historical.slice(-30),
    forecast: forecastPoints,
    dayOfWeekAverage: dayOfWeekAvg,
    forecastSummary: {
      expectedBookings: Math.round(forecastPoints.reduce((s, p) => s + p.predictedBookings, 0)),
      expectedRevenue:
        Math.round(forecastPoints.reduce((s, p) => s + p.predictedRevenue, 0) * 100) / 100,
      peakDemandDay: peak
        ? new Date(peak.date).toLocaleDateString("en-MY", { weekday: "long" })
        : "-",
      peakDemandDate: peak?.date ?? null,
      latePaymentRisk,
      modelType: resolveModelType(historical.length, nonZeroCount),
      dataPoints: nonZeroCount,
    },
    monthlySummary: null,
    demandInsights: computeInsights(
      historical,
      forecastPoints,
      dayOfWeekAvg,
      popularServices,
      latePaymentRisk
    ),
    popularServices,
    availableMonths,
  };
}
