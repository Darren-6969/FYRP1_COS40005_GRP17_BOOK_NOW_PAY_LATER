import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatOperatorMoney,
  operatorService,
} from "../../services/operator_service";

// ─── Custom tooltip for the revenue chart ────────────────────────────────────
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const items = payload.filter(
    (p) => p.dataKey !== "lower" && p.dataKey !== "ciWidth"
  );

  return (
    <div className="operator-forecast-tooltip">
      <p className="forecast-tooltip-label">{label}</p>
      {items.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: {formatOperatorMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function Metric({ label, value, sub = "Live backend data", variant = "" }) {
  return (
    <div className={`operator-metric ${variant}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OperatorSalesReport() {
  const [summary, setSummary] = useState(null);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [demandForecast, setDemandForecast] = useState([]);
  const [forecastSummary, setForecastSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await operatorService.getReports();
      setSummary(res.data.summary ?? {});
      setPaymentMethodBreakdown(res.data.paymentMethodBreakdown ?? []);
      setRevenueTrend(res.data.revenueTrend ?? []);
      setDemandForecast(res.data.demandForecast ?? []);
      setForecastSummary(res.data.forecastSummary ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // Merge historical + forecast into one series for the revenue chart.
  // CI band uses a stacked-area trick: "lower" fills 0→lower (transparent),
  // "ciWidth" fills lower→upper (shaded blue).
  const revenueChartData = useMemo(() => {
    const hist = revenueTrend.map((d) => ({
      date: d.date.slice(5),
      actual: Math.round(d.revenue * 100) / 100,
    }));
    const fcast = demandForecast.map((d) => ({
      date: d.date.slice(5),
      predicted: Math.round(d.predictedRevenue * 100) / 100,
      lower: Math.round(d.revenueLower * 100) / 100,
      ciWidth: Math.round((d.revenueUpper - d.revenueLower) * 100) / 100,
    }));
    return [...hist, ...fcast];
  }, [revenueTrend, demandForecast]);

  // Bar chart for bookings – next 14 days only to keep it readable
  const bookingChartData = useMemo(
    () =>
      demandForecast.slice(0, 14).map((d) => ({
        date: d.date.slice(5),
        bookings: Math.round(d.predictedBookings * 10) / 10,
      })),
    [demandForecast]
  );

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading report…</div>
      </div>
    );
  }

  const lateRisk = forecastSummary?.latePaymentRisk ?? 0;
  const riskVariant = lateRisk >= 30 ? "danger" : lateRisk >= 10 ? "warning" : "success";

  return (
    <div className="operator-page">
      {/* ── Page header ── */}
      <section className="operator-page-head">
        <div>
          <h1>Sales Report</h1>
          <p>
            Revenue analytics, booking trends, and SARIMA-powered demand
            forecasting.
          </p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadReport}>
            Retry
          </button>
        </div>
      )}

      {/* ── Historical KPIs ── */}
      <section className="operator-metric-grid five">
        <Metric
          label="Total Revenue"
          value={formatOperatorMoney(summary?.totalRevenue ?? 0)}
        />
        <Metric label="Total Bookings" value={summary?.totalBookings ?? 0} />
        <Metric label="Paid Bookings" value={summary?.paidBookings ?? 0} />
        <Metric
          label="Pending Payments"
          value={summary?.pendingPayments ?? 0}
        />
        <Metric
          label="Payment Completion"
          value={`${summary?.paymentCompletionRate ?? 0}%`}
        />
      </section>

      {/* ── Forecast KPIs ── */}
      {forecastSummary && (
        <section className="operator-metric-grid four">
          <Metric
            label="Next 7 Days Revenue"
            value={formatOperatorMoney(forecastSummary.next7DaysRevenue)}
            sub="Forecast"
            variant="info"
          />
          <Metric
            label="Next 7 Days Bookings"
            value={forecastSummary.next7DaysBookings}
            sub="Forecast"
            variant="info"
          />
          <Metric
            label="Late Payment Risk"
            value={`${lateRisk}%`}
            sub="Based on last 30 days"
            variant={riskVariant}
          />
          <Metric
            label="Forecast Model"
            value={forecastSummary.modelType}
            sub={`${forecastSummary.dataPoints} data points`}
          />
        </section>
      )}

      {/* ── Revenue trend + forecast chart (full width) ── */}
      <div className="operator-card operator-forecast-card">
        <div className="operator-card-head">
          <div>
            <h2>Revenue Trend &amp; 30-Day Forecast</h2>
            <p>
              Solid line — actual revenue (last 30 days). Dashed line — SARIMA
              forecast. Shaded area — 95% confidence interval.
            </p>
          </div>
          {forecastSummary && (
            <span className="operator-model-badge">
              {forecastSummary.modelType}
            </span>
          )}
        </div>

        {revenueChartData.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart
                data={revenueChartData}
                margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#93c5fd"
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="100%"
                      stopColor="#93c5fd"
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={Math.floor(revenueChartData.length / 8)}
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000
                      ? `RM${(v / 1000).toFixed(1)}k`
                      : `RM${v}`
                  }
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={64}
                />

                <Tooltip content={<RevenueTooltip />} />
                <Legend
                  formatter={(value) => {
                    if (value === "95% CI") return "95% Confidence Interval";
                    return value;
                  }}
                />

                {/* CI band — stacked: transparent base lifts the fill to start at "lower" */}
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
                  fill="url(#ciGradient)"
                  legendType="square"
                  name="95% CI"
                  connectNulls
                />

                {/* Historical actual revenue */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  name="Actual Revenue"
                  connectNulls
                />

                {/* SARIMA forecast */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="7 4"
                  dot={false}
                  name="Forecast"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="operator-chart-legend">
              <span>
                <i className="legend-blue" /> Actual Revenue
              </span>
              <span>
                <i className="legend-orange" /> SARIMA Forecast
              </span>
              <span>
                <i style={{ background: "#93c5fd", display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 6 }} />
                95% Confidence Interval
              </span>
            </div>
          </>
        ) : (
          <div className="operator-empty-state">
            Not enough historical data for the forecast chart yet. Data will
            appear after your first bookings are recorded.
          </div>
        )}
      </div>

      {/* ── Bottom row: payment breakdown + booking forecast ── */}
      <section className="operator-report-grid">
        {/* Payment method breakdown */}
        <div className="operator-card">
          <h2>Payment Method Breakdown</h2>

          <div className="operator-method-list">
            {paymentMethodBreakdown.map((item) => (
              <p key={item.method}>
                <span>{item.method}</span>
                <strong>{formatOperatorMoney(item.amount)}</strong>
              </p>
            ))}
            {!paymentMethodBreakdown.length && (
              <div className="operator-empty-state">
                No paid payment method data yet.
              </div>
            )}
          </div>
        </div>

        {/* Booking volume forecast */}
        <div className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>Booking Volume Forecast</h2>
              <p>Predicted bookings — next 14 days</p>
            </div>
          </div>

          {bookingChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart
                data={bookingChartData}
                margin={{ top: 0, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip
                  formatter={(v) => [v, "Predicted Bookings"]}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Bar
                  dataKey="bookings"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Predicted Bookings"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="operator-empty-state">
              No forecast data available yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
