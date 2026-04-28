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
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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

  const openReceipt = (payment) => {
    const receipt = payment.booking?.receipt;

    if (!receipt?.imageUrl) {
      alert("No receipt image found for this payment.");
      return;
    }

    setSelectedReceipt({
      imageUrl: receipt.imageUrl,
      remarks: receipt.remarks,
      status: receipt.status,
      uploadedAt: receipt.uploadedAt,
      bookingCode: payment.booking?.bookingCode || payment.bookingId,
      customerName: payment.booking?.customer?.name || "-",
      method: payment.method || "-",
      amount: payment.amount,
    });
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
          <button type="button" onClick={loadPayments}>
            Retry
          </button>
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
                    <td>
                      <strong>
                        {payment.booking?.bookingCode || payment.bookingId}
                      </strong>
                    </td>
                    <td>{payment.booking?.customer?.name || "-"}</td>
                    <td>{payment.method || "-"}</td>
                    <td>{formatOperatorMoney(payment.amount)}</td>
                    <td>
                      {payment.booking?.receipt?.imageUrl ? (
                        <button
                          type="button"
                          className="operator-link-btn"
                          onClick={() => openReceipt(payment)}
                        >
                          View Receipt
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={`operator-status ${operatorStatusClass(
                          payment.status
                        )}`}
                      >
                        {operatorStatusLabel(payment.status)}
                      </span>
                    </td>
                    <td>
                      <div className="operator-table-actions">
                        <button
                          className="success"
                          disabled={!!actionLoading}
                          onClick={() => handleApprove(payment.id)}
                          title="Approve payment"
                        >
                          ✓
                        </button>

                        <button
                          className="danger"
                          disabled={!!actionLoading}
                          onClick={() => handleReject(payment.id)}
                          title="Reject payment"
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

      {selectedReceipt && (
        <div
          className="operator-modal-backdrop"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="operator-modal operator-receipt-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="operator-card-head">
              <div>
                <p className="operator-eyebrow">Payment Receipt</p>
                <h2>{selectedReceipt.bookingCode}</h2>
                <p>
                  {selectedReceipt.customerName} · {selectedReceipt.method} ·{" "}
                  {formatOperatorMoney(selectedReceipt.amount)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close receipt preview"
              >
                ×
              </button>
            </div>

            <div className="operator-receipt-preview">
              <img src={selectedReceipt.imageUrl} alt="Uploaded receipt" />
            </div>

            <div className="operator-receipt-meta">
              <div>
                <span>Status</span>
                <strong>{selectedReceipt.status || "-"}</strong>
              </div>

              <div>
                <span>Uploaded At</span>
                <strong>{formatOperatorDateTime(selectedReceipt.uploadedAt)}</strong>
              </div>

              <div>
                <span>Remarks</span>
                <strong>{selectedReceipt.remarks || "-"}</strong>
              </div>
            </div>

            <div className="operator-modal-actions">
              <button
                type="button"
                className="operator-secondary-btn"
                onClick={() => setSelectedReceipt(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}