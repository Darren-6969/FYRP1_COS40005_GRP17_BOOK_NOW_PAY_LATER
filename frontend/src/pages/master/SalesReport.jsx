import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Clock, CheckCircle, XCircle,
  Percent, BarChart2, RefreshCw, Download, Info, Landmark,
} from "lucide-react";
import { getSalesReport, getOperators } from "../../services/admin_service";

// ── Formatters ───────────────────────────────────────────
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

// ── CSV export ───────────────────────────────────────────
function exportCsv({ summary, trend, appliedFrom, appliedTo, operatorLabel }) {
  const lines = [
    ["Sales Report Export"],
    [`Reporting Period: ${appliedFrom || "All time"} to ${appliedTo || "today"}`],
    [`Operator Filter: ${operatorLabel}`],
    [],
    ["--- Summary ---"],
    ["Metric", "Value"],
    ["Total Revenue (Paid + Pending)", Number(summary?.totalRevenue || 0).toFixed(2)],
    ["Paid Revenue", Number(summary?.paidRevenue || 0).toFixed(2)],
    ["Pending Revenue", Number(summary?.pendingRevenue || 0).toFixed(2)],
    ["Commission Earned", Number(summary?.commissionEarned || 0).toFixed(2)],
    ["Platform Fee %", summary?.platformFeePercent ?? 10],
    ["Total Bookings", summary?.totalBookings ?? 0],
    ["Successful Bookings", summary?.successfulBookings ?? 0],
    ["Cancelled / Rejected Bookings", summary?.cancelledBookings ?? 0],
    ["Payment Completion Rate (%)", summary?.paymentCompletionRate ?? 0],
    [],
    ["--- Monthly Trend ---"],
    ["Month", "Revenue (RM)", "Transactions", "Cancellations"],
    ...trend.map((row) => [row.month, Number(row.revenue).toFixed(2), row.transactions, row.cancelled]),
  ];

  const csv = lines.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales_report_${appliedFrom}_${appliedTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ───────────────────────────────────────
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
        <div style={{
          background: color + "1a", borderRadius: 8, padding: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
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

function InfoBox({ children }) {
  return (
    <div style={{
      background: "#e6f1fb", border: "1px solid #b5d4f4", borderRadius: 10,
      padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <Info size={16} color="#185FA5" style={{ flexShrink: 0, marginTop: 2 }} />
      <p style={{ margin: 0, fontSize: 13, color: "#0c447c", lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export default function SalesReport() {
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const [from, setFrom] = useState(sixMonthsAgo);
  const [to, setTo] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(sixMonthsAgo);
  const [appliedTo, setAppliedTo] = useState(today);

  const [operatorId, setOperatorId] = useState("");
  const [appliedOperatorId, setAppliedOperatorId] = useState("");
  const [operators, setOperators] = useState([]);

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartMode, setChartMode] = useState("revenue");

  // Load operator list for filter dropdown
  useEffect(() => {
    getOperators()
      .then((res) => setOperators(res.data?.operators || res.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (f, t, opId) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (f) params.from = f;
      if (t) params.to = t;
      if (opId) params.operatorId = opId;
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
    load(appliedFrom, appliedTo, appliedOperatorId);
  }, [load, appliedFrom, appliedTo, appliedOperatorId]);

  function applyFilter() {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedOperatorId(operatorId);
  }

  function resetFilter() {
    setFrom(sixMonthsAgo);
    setTo(today);
    setOperatorId("");
    setAppliedFrom(sixMonthsAgo);
    setAppliedTo(today);
    setAppliedOperatorId("");
  }

  const completionColor =
    (summary?.paymentCompletionRate ?? 0) >= 70 ? "#0f6e56"
    : (summary?.paymentCompletionRate ?? 0) >= 40 ? "#854f0b"
    : "#a32d2d";

  const operatorLabel = appliedOperatorId
    ? operators.find((o) => String(o.id) === String(appliedOperatorId))?.companyName || `Operator ${appliedOperatorId}`
    : "All Operators";

  return (
    <div className="page-stack" style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="section-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Sales Report</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Platform-wide revenue and booking performance summary
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Operator filter */}
          <select
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 10px", fontSize: 13 }}
          >
            <option value="">All Operators</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.companyName || `Operator ${op.id}`}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, color: "#374151" }}>From</label>
          <input
            type="date" value={from} max={to}
            onChange={(e) => setFrom(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 10px", fontSize: 13 }}
          />
          <label style={{ fontSize: 13, color: "#374151" }}>To</label>
          <input
            type="date" value={to} min={from} max={today}
            onChange={(e) => setTo(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 10px", fontSize: 13 }}
          />
          <button className="btn primary" onClick={applyFilter} disabled={loading}>Apply</button>
          <button
            className="btn" onClick={resetFilter} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <RefreshCw size={13} /> Reset
          </button>
          <button
            className="btn"
            onClick={() => exportCsv({ summary, trend, appliedFrom, appliedTo, operatorLabel })}
            disabled={loading || !summary}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Active filter pill */}
      {(appliedOperatorId || appliedFrom !== sixMonthsAgo || appliedTo !== today) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {appliedOperatorId && (
            <span className="tenant-pill">Operator: {operatorLabel}</span>
          )}
          <span className="tenant-pill">{appliedFrom} → {appliedTo}</span>
        </div>
      )}

      {error && (
        <div className="card" style={{ background: "#fcebeb", border: "1px solid #f5c6cb", color: "#a32d2d" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
          Loading report data…
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
            <KpiCard icon={DollarSign} label="Total Revenue" value={fmt(summary?.totalRevenue)} sub="Paid + pending" color="#185FA5" />
            <KpiCard icon={CheckCircle} label="Paid Revenue" value={fmt(summary?.paidRevenue)} sub="Collected payments" color="#0f6e56" />
            <KpiCard icon={Clock} label="Pending Revenue" value={fmt(summary?.pendingRevenue)} sub="Awaiting payment" color="#854f0b" />
            <KpiCard
              icon={Landmark}
              label="Commission Earned"
              value={fmt(summary?.commissionEarned)}
              sub={`${summary?.platformFeePercent ?? 10}% of paid revenue`}
              color="#7c3aed"
            />
            <KpiCard icon={TrendingUp} label="Successful Bookings" value={(summary?.successfulBookings ?? 0).toLocaleString()} sub={`of ${(summary?.totalBookings ?? 0).toLocaleString()} total`} color="#185FA5" />
            <KpiCard icon={XCircle} label="Cancelled / Voided" value={(summary?.cancelledBookings ?? 0).toLocaleString()} sub="Cancelled or rejected" color="#e24b4a" />
            <KpiCard icon={Percent} label="Completion Rate" value={`${summary?.paymentCompletionRate ?? 0}%`} sub="Bookings paid / total" color={completionColor} />
          </div>

          {/* ── Bar chart ── */}
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
                  <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={chartMode === "revenue" ? (v) => `RM ${(v / 1000).toFixed(0)}k` : undefined}
                    width={chartMode === "revenue" ? 64 : 40}
                  />
                  <Tooltip content={<CustomTooltip mode={chartMode} />} />
                  <Bar dataKey={chartMode} fill={CHART_COLORS[chartMode]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Revenue vs Cancellations line chart ── */}
          {trend.length > 1 && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <TrendingUp size={18} color="#185FA5" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Revenue vs Cancellations</h3>
              </div>

              {/* How to read this chart */}
              <InfoBox>
                <strong>How to interpret this chart:</strong> The blue line (left axis) tracks
                monthly collected revenue in RM. The red dashed line (right axis) tracks the number
                of cancelled or rejected bookings that month.
                <br /><br />
                <strong>Look for correlation:</strong> If the red line rises while the blue line
                falls, cancellations are directly hurting revenue — investigate whether operators
                are rejecting bookings, customers are abandoning payments, or overdue deadlines are
                too aggressive.
                <br /><br />
                <strong>Healthy pattern:</strong> A flat or falling red line alongside a steady or
                rising blue line means the platform is converting bookings efficiently. Spikes in
                the red line that are NOT reflected in blue often indicate short-term demand issues
                rather than structural problems.
              </InfoBox>

              <div style={{ marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12, fill: "#6b7280" }} />
                    <YAxis yAxisId="rev" orientation="left" tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`} width={64} />
                    <YAxis yAxisId="cancel" orientation="right" tick={{ fontSize: 12, fill: "#6b7280" }} width={36} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "revenue" ? [fmt(value), "Revenue"] : [value, "Cancellations"]
                      }
                      labelFormatter={fmtMonth}
                    />
                    <Legend formatter={(v) => v === "revenue" ? "Revenue (RM)" : "Cancellations"} />
                    <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#185FA5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line yAxisId="cancel" type="monotone" dataKey="cancelled" stroke="#e24b4a" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Period summary table ── */}
          <div className="card">
            <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Period Summary</h3>
            <table className="table">
              <tbody>
                {[
                  ["Reporting Period", `${appliedFrom || "All time"} → ${appliedTo || "today"}`],
                  ["Operator Filter", operatorLabel],
                  ["Total Bookings", (summary?.totalBookings ?? 0).toLocaleString()],
                  ["Successful Bookings", (summary?.successfulBookings ?? 0).toLocaleString()],
                  ["Cancelled / Rejected Bookings", (summary?.cancelledBookings ?? 0).toLocaleString()],
                  ["Total Revenue (Paid + Pending)", fmt(summary?.totalRevenue)],
                  ["Collected (Paid) Revenue", fmt(summary?.paidRevenue)],
                  ["Pending Revenue", fmt(summary?.pendingRevenue)],
                  [`Commission Earned (${summary?.platformFeePercent ?? 10}% of paid)`, fmt(summary?.commissionEarned)],
                  ["Payment Completion Rate", `${summary?.paymentCompletionRate ?? 0}%`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ color: "#6b7280", width: "55%" }}>{label}</td>
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
