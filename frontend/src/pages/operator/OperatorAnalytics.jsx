import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadElementAsPdf } from "../../utils/pdfUtils";
import {
  formatOperatorMoney,
  operatorService,
} from "../../services/operator_service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadCSV(historical, forecast, period) {
  const rows = [
    [
      "Date",
      "Actual Bookings",
      "Actual Revenue (MYR)",
      "Predicted Bookings",
      "Predicted Revenue (MYR)",
      "CI Lower (MYR)",
      "CI Upper (MYR)",
    ],
    ...historical.map((d) => [
      d.date,
      d.bookings,
      d.revenue.toFixed(2),
      "",
      "",
      "",
      "",
    ]),
    ...forecast.map((d) => [
      d.date,
      "",
      "",
      d.predictedBookings,
      d.predictedRevenue.toFixed(2),
      d.revenueLower.toFixed(2),
      d.revenueUpper.toFixed(2),
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${period || "current"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const INSIGHT_ICONS = { success: "↑", warning: "⚠", danger: "!", info: "→", neutral: "·" };
const DOW_COLORS = ["#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#f59e0b", "#f59e0b"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Metric({ label, value, sub, variant = "" }) {
  return (
    <div className={`operator-metric ${variant}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function BookingChart({ data, modelType, isPast }) {
  const interval = Math.max(1, Math.floor(data.length / 8));
  return (
    <div className="operator-card">
      <div className="operator-card-head">
        <div>
          <h2>Booking Trend &amp; SARIMA Forecast</h2>
          <p>
            {isPast
              ? "Actual daily bookings for the selected period."
              : "Solid — actual bookings (last 30 days). Dashed — SARIMA forecast (next 30 days). Shaded — 95% CI."}
          </p>
        </div>
        {modelType && <span className="operator-model-badge">{modelType}</span>}
      </div>

      {data.length > 1 ? (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bkgCiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={interval}
              />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={34} />
              <Tooltip
                labelStyle={{ fontWeight: 700 }}
                formatter={(v, name) =>
                  name === "CI Base" || name === "95% CI" ? null : [v, name]
                }
              />
              <Area
                type="monotone"
                dataKey="lower"
                stackId="ci"
                stroke="none"
                fill="#f8fbff"
                legendType="none"
                name="CI Base"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="ciWidth"
                stackId="ci"
                stroke="none"
                fill="url(#bkgCiGrad)"
                legendType="none"
                name="95% CI"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                name="Actual Bookings"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="7 4"
                dot={false}
                name="SARIMA Forecast"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="operator-chart-legend">
            <span><i className="legend-blue" /> Actual Bookings</span>
            {!isPast && <span><i className="legend-orange" /> SARIMA Forecast</span>}
            {!isPast && (
              <span>
                <i className="legend-ci" /> 95% CI
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="operator-empty-state">Not enough data to render the chart yet.</div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OperatorAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef(null);

  const load = useCallback(async (period) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (period) {
        const [y, m] = period.split("-");
        params.year = y;
        params.month = m;
      }
      const res = await operatorService.getAnalytics(params);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedPeriod);
  }, [load, selectedPeriod]);

  // Booking trend chart: historical actual + SARIMA CI + forecast line
  const bookingChartData = useMemo(() => {
    if (!data) return [];
    const hist = (data.historical ?? []).map((d) => ({
      date: d.date.slice(5),
      actual: d.bookings,
    }));
    const fcast = (data.forecast ?? []).map((d) => ({
      date: d.date.slice(5),
      predicted: d.predictedBookings,
      lower: d.bookingsLower,
      ciWidth: Math.max(0, d.bookingsUpper - d.bookingsLower),
    }));
    return [...hist, ...fcast];
  }, [data]);

  const isPast = data?.mode === "monthly" && !data?.forecastSummary;
  const fs = data?.forecastSummary;
  const ms = data?.monthlySummary;
  const dowData = data?.dayOfWeekAverage ?? [];
  const insights = data?.demandInsights ?? [];
  const services = data?.popularServices ?? [];
  const availableMonths = data?.availableMonths ?? [];

  const periodLabel = selectedPeriod
    ? availableMonths.includes(selectedPeriod)
      ? (() => {
          const [y, m] = selectedPeriod.split("-");
          return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-MY", {
            month: "long",
            year: "numeric",
          });
        })()
      : selectedPeriod
    : "Current (Last 30 days + 30-day Forecast)";

  const handleExportCSV = () => {
    if (!data) return;
    downloadCSV(data.historical ?? [], data.forecast ?? [], selectedPeriod || new Date().toISOString().slice(0, 7));
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await downloadElementAsPdf(
        contentRef.current,
        `analytics-${selectedPeriod || new Date().toISOString().slice(0, 7)}.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="operator-page">
      {/* ── Header ── */}
      <section className="operator-page-head">
        <div>
          <h1>Analytics &amp; Demand Forecast</h1>
          <p>SARIMA-powered booking trends, demand forecasting, and service insights.</p>
        </div>
        <div className="analytics-controls">
          <select
            className="analytics-period-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="">Current (Last 30d + 30d Forecast)</option>
            {[...availableMonths].reverse().map((m) => {
              const [y, mo] = m.split("-");
              const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-MY", {
                month: "long",
                year: "numeric",
              });
              return (
                <option key={m} value={m}>
                  {label}
                </option>
              );
            })}
          </select>
          <button type="button" className="analytics-btn secondary" onClick={handleExportCSV} disabled={loading}>
            ↓ CSV
          </button>
          <button type="button" className="analytics-btn" onClick={handleExportPDF} disabled={loading || exporting}>
            {exporting ? "Exporting…" : "↓ PDF"}
          </button>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={() => load(selectedPeriod)}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="operator-card" style={{ textAlign: "center", padding: 40 }}>
          Loading analytics…
        </div>
      )}

      {!loading && data && (
        <div ref={contentRef}>
          {/* ── 30-day Forecast KPIs (dashboard mode or current month) ── */}
          {fs && (
            <section className="operator-metric-grid three">
              <Metric
                label="Expected Bookings (30 days)"
                value={fs.expectedBookings}
                sub="SARIMA Forecast"
                variant="info"
              />
              <Metric
                label="Expected Revenue (30 days)"
                value={formatOperatorMoney(fs.expectedRevenue)}
                sub="SARIMA Forecast"
                variant="info"
              />
              <Metric
                label="Peak Demand Day"
                value={fs.peakDemandDay}
                sub={fs.peakDemandDate ?? "Highest forecasted day"}
              />
            </section>
          )}

          {/* ── Monthly summary KPIs (monthly mode) ── */}
          {ms && (
            <section className="operator-metric-grid four">
              <Metric
                label="Total Bookings"
                value={ms.totalBookings}
                sub={data.period?.label}
              />
              <Metric
                label="Paid Bookings"
                value={ms.paidBookings}
                sub={data.period?.label}
              />
              <Metric
                label="Total Revenue"
                value={formatOperatorMoney(ms.totalRevenue)}
                sub={data.period?.label}
              />
              <Metric
                label="Avg Daily Bookings"
                value={ms.avgDailyBookings}
                sub="bookings / day"
              />
            </section>
          )}

          {/* ── Booking trend + forecast chart ── */}
          <BookingChart
            data={bookingChartData}
            modelType={fs?.modelType}
            isPast={isPast}
          />

          {/* ── Day-of-week + Demand Insights ── */}
          <section className="operator-report-grid">
            {/* Day-of-week average */}
            <div className="operator-card">
              <h2>Avg Bookings by Day of Week</h2>
              <p className="analytics-card-sub">
                Based on {selectedPeriod ? periodLabel : "the last 90 days"}
              </p>
              {dowData.some((d) => d.average > 0) ? (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart
                    data={dowData}
                    margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      formatter={(v) => [v, "Avg Bookings"]}
                      labelStyle={{ fontWeight: 700 }}
                    />
                    <Bar dataKey="average" radius={[4, 4, 0, 0]} name="Avg Bookings">
                      {dowData.map((entry, i) => (
                        <Cell key={entry.day} fill={DOW_COLORS[i] ?? "#3b82f6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="operator-empty-state">No booking data available yet.</div>
              )}
            </div>

            {/* Demand Insights */}
            <div className="operator-card">
              <h2>Demand Insights</h2>
              <p className="analytics-card-sub">Analysis of your booking patterns</p>
              {insights.length > 0 ? (
                <ul className="analytics-insights-list">
                  {insights.map((item, i) => (
                    <li key={i} className={`analytics-insight-item ${item.type}`}>
                      <span className="insight-icon">{INSIGHT_ICONS[item.type]}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="operator-empty-state">No insights available yet.</div>
              )}
            </div>
          </section>

          {/* ── Popular Services ── */}
          <div className="operator-card">
            <h2>Popular Services</h2>
            <p className="analytics-card-sub">
              {selectedPeriod ? `Booking activity — ${periodLabel}` : "Last 30 days"}
            </p>
            {services.length > 0 ? (
              <table className="analytics-services-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Service</th>
                    <th>Bookings</th>
                    <th>Revenue</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => (
                    <tr key={s.service}>
                      <td className="analytics-rank">{i + 1}</td>
                      <td>{s.service}</td>
                      <td>{s.count}</td>
                      <td>{formatOperatorMoney(s.revenue)}</td>
                      <td>
                        <div className="analytics-pct-bar">
                          <div
                            className="analytics-pct-fill"
                            style={{ width: `${s.pct}%` }}
                          />
                          <span>{s.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="operator-empty-state">
                No service data available for this period.
              </div>
            )}
          </div>

          {/* ── Model info footer ── */}
          {fs && (
            <div className="analytics-model-footer">
              <span className="operator-model-badge">{fs.modelType}</span>
              <span className="analytics-model-info">
                Trained on {fs.dataPoints} non-zero data point
                {fs.dataPoints !== 1 ? "s" : ""}. Forecasts are estimates based on
                historical booking patterns.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
