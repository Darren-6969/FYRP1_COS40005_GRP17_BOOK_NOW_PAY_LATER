import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatOperatorMoney,
  operatorService,
} from "../../services/operator_service";

function Metric({ label, value, sub = "All time" }) {
  return (
    <div className="operator-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

export default function OperatorSalesReport() {
  const [summary, setSummary] = useState(null);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await operatorService.getReports();
      setSummary(res.data.summary ?? {});
      setPaymentMethodBreakdown(res.data.paymentMethodBreakdown ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading report…</div>
      </div>
    );
  }

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Sales Report</h1>
          <p>Financial snapshot — total revenue, booking counts, and payment breakdown.</p>
        </div>
        <Link to="/operator/analytics" className="operator-btn-link">
          View Analytics &amp; Demand Forecast →
        </Link>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadReport}>Retry</button>
        </div>
      )}

      <section className="operator-metric-grid five">
        <Metric
          label="Total Revenue"
          value={formatOperatorMoney(summary?.totalRevenue ?? 0)}
        />
        <Metric label="Total Bookings" value={summary?.totalBookings ?? 0} />
        <Metric label="Paid Bookings" value={summary?.paidBookings ?? 0} />
        <Metric label="Pending Payments" value={summary?.pendingPayments ?? 0} />
        <Metric
          label="Payment Completion"
          value={`${summary?.paymentCompletionRate ?? 0}%`}
        />
      </section>

      <section className="operator-report-grid">
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
              <div className="operator-empty-state">No paid payment method data yet.</div>
            )}
          </div>
        </div>

        <div className="operator-card">
          <h2>Cancellation Rate</h2>
          <div className="operator-metric" style={{ border: "none", boxShadow: "none", background: "transparent", padding: 0 }}>
            <strong style={{ fontSize: 48, color: summary?.cancellationRate > 20 ? "#dc2626" : "#0f172a" }}>
              {summary?.cancellationRate ?? 0}%
            </strong>
            <small style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
              {summary?.cancellationRate <= 10
                ? "Low — healthy booking acceptance rate"
                : summary?.cancellationRate <= 20
                ? "Moderate — review rejection reasons"
                : "High — action recommended"}
            </small>
          </div>
          <p style={{ marginTop: 20, fontSize: 13, color: "#64748b" }}>
            For trend charts, SARIMA demand forecasting, and service insights,
            visit{" "}
            <Link to="/operator/analytics" style={{ color: "#2563eb", fontWeight: 700 }}>
              Analytics &amp; Demand Forecast
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
