import { Link } from "react-router-dom";
import { downloadElementAsPdf } from "../../utils/pdfUtils";
import { useCustomerPayments } from "../../hooks/usePayments";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

function getRealBookingId(payment) {
  return (
    payment.booking?.bookingCode ||
    payment.bookingCode ||
    payment.booking?.id ||
    payment.bookingId ||
    "-"
  );
}

export default function CustomerPayments() {
  const { payments, loading, error } = useCustomerPayments();

  const downloadReceipt = async (payment) => {
    const element = document.createElement("div");
    element.className = "pdf-document";
    element.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#fff;color:#111";
    const heading = document.createElement("h1");
    heading.textContent = "Payment receipt";
    element.appendChild(heading);
    [
      `Receipt reference: RCP-${String(payment.id).padStart(6, "0")}`,
      `Booking: ${payment.booking?.bookingCode || payment.bookingId}`,
      `Service: ${payment.booking?.serviceName || "Booking payment"}`,
      `Payment date: ${formatCustomerDate(payment.paidAt || payment.updatedAt)}`,
      `Method: ${payment.method || "-"}`,
    ].forEach((value) => {
      const line = document.createElement("p");
      line.textContent = value;
      element.appendChild(line);
    });
    const amount = document.createElement("h2");
    amount.textContent = `Amount paid: ${formatMoney(payment.paidAmount || payment.amount || 0)}`;
    element.appendChild(amount);
    document.body.appendChild(element);
    try {
      await downloadElementAsPdf(element, `receipt-${payment.booking?.bookingCode || payment.bookingId}.pdf`);
    } finally {
      element.remove();
    }
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading payment history...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Payment History</p>
          <h1>All customer payment records</h1>
          <p>Shows Stripe and manual DuitNow/SPay payment status.</p>
        </div>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">{error}</div>
      )}

      <section className="customer-list-stack">
        {payments.map((payment) => {
          const realBookingId = getRealBookingId(payment);

          return (
            <article
              key={payment.id}
              className="customer-glass-card customer-row-card"
            >
              <div>
                <span
                  className={`customer-status status-${customerStatusClass(
                    payment.status
                  )}`}
                >
                  {statusLabel(payment.status)}
                </span>

                <h3>{payment.booking?.serviceName || "Booking Payment"}</h3>

                <p className="customer-payment-booking-id">
                  Booking ID: <strong>{realBookingId}</strong>
                </p>

                <p>
                  {payment.method} · {formatCustomerDate(payment.createdAt)}
                </p>
              </div>

              <div className="customer-row-right">
                <strong>
                  {formatMoney(payment.paidAmount || 0)} / {formatMoney(payment.amount)}
                </strong>

                <small>{statusLabel(payment.status)}</small>

                <Link
                  to={`/customer/bookings/${payment.booking?.id || payment.bookingId}`}
                  className="customer-secondary-btn small"
                >
                  View
                </Link>
                {payment.status === "PAID" && (
                  <button type="button" className="customer-secondary-btn small" onClick={() => downloadReceipt(payment)}>
                    Download receipt
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!payments.length && !error && (
        <div className="customer-empty-state">
          <h3>No payments yet</h3>
          <p>Completed or pending payments will appear here.</p>
        </div>
      )}
    </div>
  );
}