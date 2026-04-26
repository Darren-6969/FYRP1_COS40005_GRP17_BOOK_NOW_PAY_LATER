import { useEffect, useState } from "react";
import {
  operatorService,
  formatOperatorMoney,
} from "../../services/operator_service";

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

      setSummary(res.data.summary || {});
      setPaymentMethodBreakdown(res.data.paymentMethodBreakdown || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sales report");
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
        <div className="operator-card">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Sales Report</h1>
          <p>Monitor revenue, booking volume, payment completion rate, and cancellation rate.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadReport}>Retry</button>
        </div>
      )}

      <section className="operator-metric-grid five">
        <Metric label="Total Revenue" value={formatOperatorMoney(summary?.totalRevenue || 0)} />
        <Metric label="Total Bookings" value={summary?.totalBookings || 0} />
        <Metric label="Paid Bookings" value={summary?.paidBookings || 0} />
        <Metric label="Pending Payments" value={summary?.pendingPayments || 0} />
        <Metric label="Payment Completion" value={`${summary?.paymentCompletionRate || 0}%`} />
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
              <div className="operator-empty-state">
                No paid payment method data yet.
              </div>
            )}
          </div>
        </div>

        <div className="operator-card">
          <h2>Analytics / Demand Forecast</h2>
          <div className="operator-empty-state">
            SARIMA forecast data will appear here after the analytics backend is connected.
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="operator-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Live backend data</small>
    </div>
  );
}