import { useEffect, useState } from "react";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const STATUS_TABS = [
  { key: "PENDING_VERIFICATION", label: "Pending Review" },
  { key: "PAID", label: "Approved / Paid" },
  { key: "FAILED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export default function OperatorPaymentVerification() {
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState("PENDING_VERIFICATION");
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
      setActionLoading(`approve-${id}`);
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
      setActionLoading(`reject-${id}`);
      await operatorService.rejectPayment(id);
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject payment");
    } finally {
      setActionLoading("");
    }
  };

  const handleSendInvoice = async (id) => {
    try {
      setActionLoading(`invoice-${id}`);
      await operatorService.sendPaymentInvoice(id);
      alert("Invoice sent successfully.");
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send invoice");
    } finally {
      setActionLoading("");
    }
  };

  const handleSendReceipt = async (id) => {
    try {
      setActionLoading(`receipt-${id}`);
      await operatorService.sendPaymentReceipt(id);
      alert("Receipt sent successfully.");
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send receipt");
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

  const renderActions = (payment) => {
    const status = String(payment.status || "").toUpperCase();
    const isLoading = actionLoading.includes(String(payment.id));

    if (status === "PENDING_VERIFICATION") {
      return (
        <div className="operator-table-actions">
          <button
            className="success"
            disabled={isLoading}
            onClick={() => handleApprove(payment.id)}
            title="Approve payment"
          >
            ✓
          </button>

          <button
            className="danger"
            disabled={isLoading}
            onClick={() => handleReject(payment.id)}
            title="Reject payment"
          >
            ×
          </button>
        </div>
      );
    }

    if (status === "PAID") {
      return (
        <div className="operator-paid-actions">
          <button
            type="button"
            className="operator-mini-action primary"
            disabled={isLoading}
            onClick={() => handleSendInvoice(payment.id)}
          >
            Send Invoice
          </button>

          <button
            type="button"
            className="operator-mini-action secondary"
            disabled={isLoading}
            onClick={() => handleSendReceipt(payment.id)}
          >
            Send Receipt
          </button>
        </div>
      );
    }

    if (status === "FAILED") {
      return <span className="operator-muted-text">Rejected</span>;
    }

    return <span className="operator-muted-text">No action</span>;
  };

  const pendingCount = payments.filter(
    (p) => String(p.status).toUpperCase() === "PENDING_VERIFICATION"
  ).length;

  const visiblePayments =
    activeTab === "ALL"
      ? payments
      : payments.filter((p) => String(p.status).toUpperCase() === activeTab);

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Payment Verification</h1>
          <p>
            Review and approve manual payment receipts submitted by customers
            (DuitNow, SPay, bank transfer). For Stripe payment financial
            breakdowns, see <strong>Settlements</strong>.
          </p>
        </div>

        <button
          type="button"
          className="operator-secondary-btn"
          onClick={loadPayments}
        >
          Refresh
        </button>
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
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "ALL"
                ? payments.length
                : payments.filter(
                    (p) => String(p.status).toUpperCase() === tab.key
                  ).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: isActive
                    ? "1.5px solid #2563eb"
                    : "1.5px solid #e2e8f0",
                  background: isActive ? "#2563eb" : "white",
                  color: isActive ? "white" : "#374151",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.key === "PENDING_VERIFICATION" && pendingCount > 0 && (
                  <span
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "#ef4444",
                      color: "white",
                      borderRadius: 999,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading payments...</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visiblePayments.map((payment) => (
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
                          View
                        </button>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>None</span>
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

                    <td>{renderActions(payment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!visiblePayments.length && (
              <div className="operator-empty-state">
                {activeTab === "PENDING_VERIFICATION"
                  ? "No receipts awaiting review."
                  : "No records for this filter."}
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
                <p className="operator-eyebrow">Payment Receipt Proof</p>
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
                <strong>
                  {formatOperatorDateTime(selectedReceipt.uploadedAt)}
                </strong>
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