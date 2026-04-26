import { useEffect, useState } from "react";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorPaymentVerification() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getPayments();

      setPayments(res.data.payments || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await operatorService.approvePayment(id);
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve payment");
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoading(id);
      await operatorService.rejectPayment(id);
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject payment");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Payment Verification</h1>
          <p>Review and verify payments submitted by customers.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadPayments}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        {loading ? (
          <div className="operator-empty-state">Loading payments...</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Submitted Time</th>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatOperatorDateTime(payment.createdAt)}</td>
                    <td>{payment.bookingId}</td>
                    <td>{payment.booking?.customer?.name || "-"}</td>
                    <td>{payment.method || "-"}</td>
                    <td>{formatOperatorMoney(payment.amount)}</td>
                    <td>
                      {payment.booking?.receipt?.imageUrl ? (
                        <a href={payment.booking.receipt.imageUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span className={`operator-status ${operatorStatusClass(payment.status)}`}>
                        {operatorStatusLabel(payment.status)}
                      </span>
                    </td>
                    <td>
                      <div className="operator-table-actions">
                        <button
                          className="success"
                          disabled={!!actionLoading}
                          onClick={() => handleApprove(payment.id)}
                        >
                          ✓
                        </button>

                        <button
                          className="danger"
                          disabled={!!actionLoading}
                          onClick={() => handleReject(payment.id)}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!payments.length && (
              <div className="operator-empty-state">
                No payment records found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}