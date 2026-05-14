import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Clock, CheckCircle,
  XCircle, Percent, BarChart2, RefreshCw,
} from "lucide-react";
import { getSalesReport } from "../../services/admin_service";

function fmt(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtMonth(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-MY", {
    month: "short",
    year: "2-digit",
  });
}

const CHART_MODES = [
  { key: "revenue", label: "Revenue (RM)" },
  { key: "transactions", label: "Transactions" },
  { key: "cancelled", label: "Cancellations" },
];

const CHART_COLORS = {
  revenue: "#185FA5",
  transactions: "#0f6e56",
  cancelled: "#e24b4a",
};

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            background: color + "1a",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <strong style={{ fontSize: 22, color: "#0f172a", lineHeight: 1 }}>{value}</strong>
      {sub && <span style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</span>}
    </div>
  );
}

function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="card" style={{ padding: "8px 12px", minWidth: 140 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{fmtMonth(label)}</p>
      <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#0f172a" }}>
        {mode === "revenue" ? fmt(val) : val.toLocaleString()}
      </p>
    </div>
  );
}

export default function SalesReport() {
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(sixMonthsAgo);
  const [to, setTo] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(sixMonthsAgo);
  const [appliedTo, setAppliedTo] = useState(today);

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartMode, setChartMode] = useState("revenue");

  const load = useCallback(async (f, t) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (f) params.from = f;
      if (t) params.to = t;
      const res = await getSalesReport(params);
      setSummary(res.data.summary);
      setTrend(res.data.revenueTrend || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load sales report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(appliedFrom, appliedTo);
  }, [load, appliedFrom, appliedTo]);

  function applyFilter() {
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  function resetFilter() {
    setFrom(sixMonthsAgo);
    setTo(today);
    setAppliedFrom(sixMonthsAgo);
    setAppliedTo(today);
  }

  const completionColor =
    (summary?.paymentCompletionRate ?? 0) >= 70
      ? "#0f6e56"
      : (summary?.paymentCompletionRate ?? 0) >= 40
      ? "#854f0b"
      : "#a32d2d";

  return (
    <div className="page-stack" style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div className="section-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Sales Report</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Platform-wide revenue and booking performance summary
          </p>
        </div>

        {/* Date filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "#374151" }}>From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 13,
            }}
          />
          <label style={{ fontSize: 13, color: "#374151" }}>To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 13,
            }}
          />
          <button className="btn primary" onClick={applyFilter} disabled={loading}>
            Apply
          </button>
          <button
            className="btn"
            onClick={resetFilter}
            disabled={loading}
            title="Reset to last 6 months"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ background: "#fcebeb", border: "1px solid #f5c6cb", color: "#a32d2d" }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
          Loading report data…
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 16,
            }}
          >
            <KpiCard
              icon={DollarSign}
              label="Total Revenue"
              value={fmt(summary?.totalRevenue)}
              sub="Paid + pending"
              color="#185FA5"
            />
            <KpiCard
              icon={CheckCircle}
              label="Paid Revenue"
              value={fmt(summary?.paidRevenue)}
              sub="Collected payments"
              color="#0f6e56"
            />
            <KpiCard
              icon={Clock}
              label="Pending Revenue"
              value={fmt(summary?.pendingRevenue)}
              sub="Awaiting payment"
              color="#854f0b"
            />
            <KpiCard
              icon={TrendingUp}
              label="Successful Bookings"
              value={(summary?.successfulBookings ?? 0).toLocaleString()}
              sub={`of ${(summary?.totalBookings ?? 0).toLocaleString()} total`}
              color="#185FA5"
            />
            <KpiCard
              icon={XCircle}
              label="Cancelled / Voided"
              value={(summary?.cancelledBookings ?? 0).toLocaleString()}
              sub="Cancelled or rejected"
              color="#e24b4a"
            />
            <KpiCard
              icon={Percent}
              label="Completion Rate"
              value={`${summary?.paymentCompletionRate ?? 0}%`}
              sub="Bookings paid / total"
              color={completionColor}
            />
          </div>

          {/* Chart */}
          <div className="card">
            <div className="section-head" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={18} color="#185FA5" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Monthly Trend</h3>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {CHART_MODES.map((m) => (
                  <button
                    key={m.key}
                    className={`btn${chartMode === m.key ? " primary" : ""}`}
                    onClick={() => setChartMode(m.key)}
                    style={{ fontSize: 12 }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {trend.length === 0 ? (
              <p style={{ color: "#6b7280", textAlign: "center", padding: "32px 0" }}>
                No data for selected date range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={fmtMonth}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={
                      chartMode === "revenue"
                        ? (v) => `RM ${(v / 1000).toFixed(0)}k`
                        : undefined
                    }
                    width={chartMode === "revenue" ? 64 : 40}
                  />
                  <Tooltip content={<CustomTooltip mode={chartMode} />} />
                  <Bar
                    dataKey={chartMode}
                    fill={CHART_COLORS[chartMode]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Secondary: Revenue vs Cancellations line chart */}
          {trend.length > 1 && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TrendingUp size={18} color="#185FA5" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Revenue vs Cancellations</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={fmtMonth}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <YAxis
                    yAxisId="rev"
                    orientation="left"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`}
                    width={64}
                  />
                  <YAxis
                    yAxisId="cancel"
                    orientation="right"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    width={36}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "revenue") return [fmt(value), "Revenue"];
                      return [value, "Cancellations"];
                    }}
                    labelFormatter={fmtMonth}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "revenue" ? "Revenue (RM)" : "Cancellations"
                    }
                  />
                  <Line
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#185FA5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="cancel"
                    type="monotone"
                    dataKey="cancelled"
                    stroke="#e24b4a"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary table */}
          <div className="card">
            <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Period Summary</h3>
            <table className="table">
              <tbody>
                {[
                  ["Total Bookings", (summary?.totalBookings ?? 0).toLocaleString()],
                  ["Successful Bookings", (summary?.successfulBookings ?? 0).toLocaleString()],
                  ["Cancelled / Rejected Bookings", (summary?.cancelledBookings ?? 0).toLocaleString()],
                  ["Total Revenue (Paid + Pending)", fmt(summary?.totalRevenue)],
                  ["Collected (Paid) Revenue", fmt(summary?.paidRevenue)],
                  ["Pending Revenue", fmt(summary?.pendingRevenue)],
                  ["Payment Completion Rate", `${summary?.paymentCompletionRate ?? 0}%`],
                  [
                    "Reporting Period",
                    `${appliedFrom || "All time"} → ${appliedTo || "today"}`,
                  ],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ color: "#6b7280", width: "50%" }}>{label}</td>
                    <td style={{ fontWeight: 600 }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
