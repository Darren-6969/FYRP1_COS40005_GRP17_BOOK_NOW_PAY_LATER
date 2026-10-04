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
import api from "../../services/api";
import { downloadElementAsPdf } from "../../utils/pdfUtils";
import { formatOperatorMoney } from "../../services/operator_service";
import { getPilotMetrics } from "../../services/admin_service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadCSV(historical, forecast, operatorName, period) {
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
      d.date, d.bookings, d.revenue.toFixed(2), "", "", "", "",
    ]),
    ...forecast.map((d) => [
      d.date, "", "",
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
  a.download = `analytics-${operatorName || "platform"}-${period || "current"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadPilotCSV(report) {
  const rows = [
    ["Pilot Scorecard", "Value"],
    ["Period", `${report.period.from} to ${report.period.to}`],
    ["Bookings created", report.counts.bookingsCreated],
    ["Paid events", report.counts.paid],
    ["Completed events", report.counts.completed],
    ["Expired events", report.counts.expired],
    ["No-show events", report.counts.noShow],
    ["GMV (MYR)", report.finance.gmv.toFixed(2)],
    ["Commission revenue (MYR)", report.finance.commissionRevenue.toFixed(2)],
    ["Settled payouts (MYR)", report.finance.settledPayouts.toFixed(2)],
    ["Allocation utilisation (%)", report.allocation.utilisationRate ?? "N/A"],
    ["Reserved unit-days", report.allocation.reservedUnitDays],
    ["Allocated unit-days", report.allocation.allocatedUnitDays],
    ["Operator cancellations", report.operatorCancellation.count],
    ["Operator cancellation rate (%)", report.operatorCancellation.rate ?? "N/A"],
    [],
    ["Rates by credit tier"],
    ["Credit tier", "Cohort bookings", "Due bookings", "On-time payment rate (%)", "Expired bookings", "Expiry rate (%)"],
    ...report.paymentByCreditTier.map((tier) => [
      tier.creditTier,
      tier.bookings,
      tier.dueBookings,
      tier.onTimePaymentRate ?? "N/A",
      tier.expiredBookings,
      tier.expiryRate ?? "N/A",
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvValue).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pilot-scorecard-${report.period.from}-to-${report.period.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const INSIGHT_ICONS = { success: "↑", warning: "⚠", danger: "!", info: "→", neutral: "·" };
const DOW_COLORS = ["#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#f59e0b", "#f59e0b"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Metric({ label, value, sub, variant = "" }) {
  return (
    <div className={`master-analytics-metric ${variant}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MasterAnalytics() {
  const [operators, setOperators] = useState([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef(null);
  const [pilotPeriod, setPilotPeriod] = useState(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { from: isoDay(from), to: isoDay(today) };
  });
  const [pilotMetrics, setPilotMetrics] = useState(null);
  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotError, setPilotError] = useState("");

  useEffect(() => {
    let current = true;
    getPilotMetrics(pilotPeriod)
      .then((res) => {
        if (current) setPilotMetrics(res.data);
      })
      .catch((err) => {
        if (current) setPilotError(err.response?.data?.message ?? "Failed to load pilot scorecard.");
      })
      .finally(() => {
        if (current) setPilotLoading(false);
      });
    return () => { current = false; };
  }, [pilotPeriod]);

  // Load operator list once
  useEffect(() => {
    api.get("/operators").then((res) => {
      setOperators(res.data ?? []);
    }).catch(() => {});
  }, []);

  const selectedOperatorName = useMemo(() => {
    if (!selectedOperatorId) return "All Operators";
    return operators.find((o) => String(o.id) === String(selectedOperatorId))?.companyName ?? "Unknown";
  }, [selectedOperatorId, operators]);

  const load = useCallback(async (operatorId, period) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (operatorId) params.operatorId = operatorId;
      if (period) {
        const [y, m] = period.split("-");
        params.year = y;
        params.month = m;
      }
      const res = await api.get("/operators/analytics", { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedOperatorId, selectedPeriod);
  }, [load, selectedOperatorId, selectedPeriod]);

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
    ? (() => {
        const [y, m] = selectedPeriod.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-MY", {
          month: "long",
          year: "numeric",
        });
      })()
    : "Last 30 days + 30-day Forecast";

  const handleExportCSV = () => {
    if (!data) return;
    downloadCSV(
      data.historical ?? [],
      data.forecast ?? [],
      selectedOperatorName,
      selectedPeriod || new Date().toISOString().slice(0, 7)
    );
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const slug = `${selectedOperatorName.replace(/\s+/g, "-")}-${selectedPeriod || new Date().toISOString().slice(0, 7)}`;
      await downloadElementAsPdf(contentRef.current, `analytics-${slug}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const chartInterval = Math.max(1, Math.floor(bookingChartData.length / 8));

  return (
    <div className="master-analytics-page">
      {/* ── Header ── */}
      <section className="master-analytics-head">
        <div className="master-analytics-head-text">
          <h1>Analytics &amp; Demand Forecast</h1>
          <p>
            SARIMA demand forecasting across all operators.
            {selectedOperatorId
              ? ` Showing: ${selectedOperatorName}.`
              : " Showing platform-wide aggregated data."}
          </p>
        </div>
        <div className="master-analytics-controls">
          {/* Operator filter */}
          <select
            className="master-analytics-select"
            value={selectedOperatorId}
            onChange={(e) => {
              setSelectedOperatorId(e.target.value);
              setSelectedPeriod("");
            }}
          >
            <option value="">All Operators (Platform-wide)</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.companyName}
              </option>
            ))}
          </select>

          {/* Period filter */}
          <select
            className="master-analytics-select"
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

          <button
            type="button"
            className="master-analytics-btn secondary"
            onClick={handleExportCSV}
            disabled={loading}
          >
            ↓ CSV
          </button>
          <button
            type="button"
            className="master-analytics-btn"
            onClick={handleExportPDF}
            disabled={loading || exporting}
          >
            {exporting ? "Exporting…" : "↓ PDF"}
          </button>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={() => load(selectedOperatorId, selectedPeriod)}>
            Retry
          </button>
        </div>
      )}

      <section className="master-analytics-card" aria-labelledby="pilot-scorecard-title">
        <div className="master-analytics-card-head">
          <div>
            <h2 id="pilot-scorecard-title">Pilot Scorecard</h2>
            <p>Event counts use event dates. Tier rates use bookings created in-period and due by its end; allocation utilisation is reserved ÷ available unit-days.</p>
          </div>
          <div className="master-analytics-controls">
            <label>From <input className="master-analytics-select" type="date" value={pilotPeriod.from} max={pilotPeriod.to} onChange={(event) => { setPilotLoading(true); setPilotError(""); setPilotPeriod((period) => ({ ...period, from: event.target.value })); }} /></label>
            <label>To <input className="master-analytics-select" type="date" min={pilotPeriod.from} max={isoDay(new Date())} value={pilotPeriod.to} onChange={(event) => { setPilotLoading(true); setPilotError(""); setPilotPeriod((period) => ({ ...period, to: event.target.value })); }} /></label>
            <button type="button" className="master-analytics-btn secondary" disabled={!pilotMetrics || pilotLoading} onClick={() => downloadPilotCSV(pilotMetrics)}>↓ CSV</button>
          </div>
        </div>

        {pilotError && <div className="operator-alert danger" role="alert">{pilotError}</div>}
        {pilotLoading ? (
          <div className="operator-empty-state">Loading pilot scorecard…</div>
        ) : pilotMetrics && (
          <>
            <div className="master-analytics-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", marginBottom: 16 }}>
              <Metric label="Bookings created" value={pilotMetrics.counts.bookingsCreated.toLocaleString()} />
              <Metric label="Paid events" value={pilotMetrics.counts.paid.toLocaleString()} />
              <Metric label="Completed" value={pilotMetrics.counts.completed.toLocaleString()} />
              <Metric label="Expired" value={pilotMetrics.counts.expired.toLocaleString()} variant="warning" />
              <Metric label="No-show" value={pilotMetrics.counts.noShow.toLocaleString()} variant="warning" />
            </div>

            <div className="master-analytics-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 20 }}>
              <Metric label="GMV" value={formatOperatorMoney(pilotMetrics.finance.gmv)} sub="Gross booking value" />
              <Metric label="Commission revenue" value={formatOperatorMoney(pilotMetrics.finance.commissionRevenue)} sub="Recorded commission ledger" />
              <Metric label="Settled payouts" value={formatOperatorMoney(pilotMetrics.finance.settledPayouts)} sub="Transferred during period" />
              <Metric label="Allocation utilisation" value={pilotMetrics.allocation.utilisationRate == null ? "N/A" : `${pilotMetrics.allocation.utilisationRate}%`} sub={`${pilotMetrics.allocation.reservedUnitDays.toLocaleString()} / ${pilotMetrics.allocation.allocatedUnitDays.toLocaleString()} unit-days`} />
              <Metric label="Operator cancellation rate" value={pilotMetrics.operatorCancellation.rate == null ? "N/A" : `${pilotMetrics.operatorCancellation.rate}%`} sub={`${pilotMetrics.operatorCancellation.count.toLocaleString()} cancellations in created-booking cohort`} variant="warning" />
            </div>

            <div className="master-analytics-card-head">
              <div>
                <h2>Payment outcomes by credit tier</h2>
                <p>On-time rate = paid on/before deadline ÷ bookings due by period end. Expiry rate = expired ÷ due bookings. Tiers are snapshotted from System Settings; older bookings without a tier appear as Unconfigured.</p>
              </div>
            </div>
            {pilotMetrics.paymentByCreditTier.length ? (
              <div className="master-analytics-chart-scroll">
                <table className="analytics-services-table">
                  <thead><tr><th>Credit tier</th><th>Cohort bookings</th><th>Due by period end</th><th>On-time payment rate</th><th>Expired</th><th>Expiry rate</th></tr></thead>
                  <tbody>{pilotMetrics.paymentByCreditTier.map((tier) => (
                    <tr key={tier.creditTier}>
                      <td>{tier.creditTier}</td>
                      <td>{tier.bookings.toLocaleString()}</td>
                      <td>{tier.dueBookings.toLocaleString()}</td>
                      <td>{tier.onTimePaymentRate == null ? "N/A" : `${tier.onTimePaymentRate}%`}</td>
                      <td>{tier.expiredBookings.toLocaleString()}</td>
                      <td>{tier.expiryRate == null ? "N/A" : `${tier.expiryRate}%`}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="operator-empty-state">No bookings were created during this period.</div>}
          </>
        )}
      </section>

      {loading && (
        <div className="master-analytics-card" style={{ textAlign: "center", padding: 40 }}>
          Loading analytics…
        </div>
      )}

      {!loading && data && (
        <div ref={contentRef}>
          {/* ── Forecast KPIs ── */}
          {fs && (
            <section className="master-analytics-metric-grid three">
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

          {/* ── Monthly summary KPIs ── */}
          {ms && (
            <section className="master-analytics-metric-grid four">
              <Metric label="Total Bookings" value={ms.totalBookings} sub={data.period?.label} />
              <Metric label="Paid Bookings" value={ms.paidBookings} sub={data.period?.label} />
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

          {/* ── Booking trend + SARIMA chart ── */}
          <div className="master-analytics-card master-analytics-chart-card">
            <div className="master-analytics-card-head">
              <div>
                <h2>Booking Trend &amp; SARIMA Forecast</h2>
                <p>
                  {isPast
                    ? `Actual daily bookings — ${periodLabel}.`
                    : "Solid — actual bookings (last 30 days). Dashed — SARIMA forecast (next 30 days)."}
                </p>
              </div>
              {fs?.modelType && (
                <span className="operator-model-badge">{fs.modelType}</span>
              )}
            </div>

            {bookingChartData.length > 1 ? (
              <>
              <div className="master-analytics-chart-scroll">
              <div className="master-analytics-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={bookingChartData}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    
                    <defs>
                      <linearGradient id="masterCiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={chartInterval}
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
                      fill="url(#masterCiGrad)"
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
                </div>
              </div>
                <div className="operator-chart-legend">
                  <span><i className="legend-blue" /> Actual Bookings</span>
                  {!isPast && <span><i className="legend-orange" /> SARIMA Forecast</span>}
                  {!isPast && <span><i className="legend-ci" /> 95% CI</span>}
                </div>
              </>
            ) : (
              <div className="operator-empty-state">Not enough data to render the chart.</div>
            )}
          </div>

          {/* ── Day-of-week + Insights ── */}
          <section className="master-analytics-report-grid">
            <div className="master-analytics-card">
              <h2>Avg Bookings by Day of Week</h2>
              <p className="analytics-card-sub">
                Based on {selectedPeriod ? periodLabel : "the last 90 days"}
              </p>
              {dowData.some((d) => d.average > 0) ? (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={dowData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
                <div className="operator-empty-state">No booking data available.</div>
              )}
            </div>

            <div className="master-analytics-card">
              <h2>Demand Insights</h2>
              <p className="analytics-card-sub">Analysis of booking patterns</p>
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
                <div className="operator-empty-state">No insights available.</div>
              )}
            </div>
          </section>

          {/* ── Popular Services ── */}
          <div className="master-analytics-card">
            <h2>Popular Services</h2>
            <p className="analytics-card-sub">
              {selectedPeriod ? `Booking activity — ${periodLabel}` : "Last 30 days"}
              {selectedOperatorId ? ` · ${selectedOperatorName}` : " · All Operators"}
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
                historical patterns.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
