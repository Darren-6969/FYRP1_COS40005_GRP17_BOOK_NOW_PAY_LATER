import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { downloadElementAsPdf } from "../../utils/pdfUtils";
import { useCustomerPayments } from "../../hooks/usePayments";
import { usePagination } from "../../hooks/usePagination";
import ListPagination from "../../components/customer/ListPagination";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

// How the customer paid. PENDING in the database means no method was
// picked yet (nothing paid), which is why "PENDING" showed on the card.
const METHOD_LABELS = {
  STRIPE: "Card (Stripe)",
  DUITNOW: "DuitNow",
  SPAY: "SPay",
  PAYPAL: "PayPal",
  PENDING: "No payment method chosen yet",
};

function methodLabel(method) {
  return METHOD_LABELS[method] || statusLabel(method);
}

// One part of the payment (deposit or balance) as a short label.
function partStatus(status) {
  if (status === "PAID") return { label: "Paid", tone: "success" };
  if (String(status || "").includes("PENDING_VERIFICATION")) {
    return { label: "Pending verification", tone: "warning" };
  }
  return { label: "Unpaid", tone: "warning" };
}

function PaymentPart({ title, amount, status, dueDate }) {
  const part = partStatus(status);
  return (
    <div className="payment-card-part">
      <div className="payment-card-part-top">
        <span>{title}</span>
        <span className={`customer-status status-${part.tone}`}>{part.label}</span>
      </div>
      <strong>{formatMoney(amount)}</strong>
      {status !== "PAID" && dueDate && <small>Due {formatCustomerDate(dueDate)}</small>}
    </div>
  );
}

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
  const pagination = usePagination(payments, 10);

  const downloadReceipt = async (payment) => {
    const element = document.createElement("div");
    element.className = "pdf-document";
    element.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#fff;color:#111";
    // The operator's logo and name head the receipt, as on the invoice.
    const operator = payment.booking?.operator;
    const logoUrl = operator?.logoUrl || operator?.config?.invoiceLogoUrl;
    if (logoUrl) {
      const logo = document.createElement("img");
      logo.src = logoUrl;
      logo.alt = "Merchant logo";
      logo.style.cssText = "display:block;width:72px;height:72px;object-fit:contain;margin-bottom:8px";
      element.appendChild(logo);
    }
    if (operator?.companyName) {
      const company = document.createElement("strong");
      company.textContent = operator.companyName;
      company.style.cssText = "display:block;margin-bottom:12px";
      element.appendChild(company);
    }
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
          <p className="customer-eyebrow">Payments</p>
          <h1>Your payments</h1>
          <p>Deposits and balances for your bookings, paid by card or DuitNow.</p>
        </div>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">{error}</div>
      )}

      <section className="customer-list-stack" id="payment-list">
        {pagination.pageItems.map((payment) => {
          const realBookingId = getRealBookingId(payment);
          const bookingId = payment.booking?.id || payment.bookingId;
          const total = Number(payment.amount) || 0;
          const paid = Number(payment.paidAmount) || 0;
          const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          const hasDeposit = Number(payment.downPaymentAmount) > 0;
          const hasBalance = Number(payment.finalPaymentAmount) > 0;

          return (
            <article
              key={payment.id}
              className="customer-glass-card payment-card"
            >
              <div className="payment-card-head">
                <div>
                  <h3>{payment.booking?.serviceName || "Booking payment"}</h3>
                  <p>
                    {realBookingId}
                    {payment.booking?.operator?.companyName
                      ? ` · ${payment.booking.operator.companyName}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`customer-status status-${customerStatusClass(
                    payment.status
                  )}`}
                >
                  {statusLabel(payment.status)}
                </span>
              </div>

              <div className="payment-card-progress">
                <div className="payment-card-amounts">
                  <strong>{formatMoney(paid)}</strong>
                  <span>paid of {formatMoney(total)}</span>
                </div>
                <div
                  className="payment-card-bar"
                  role="progressbar"
                  aria-label="Amount paid"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>

              {(hasDeposit || hasBalance) && (
                <div className="payment-card-parts">
                  {hasDeposit && (
                    <PaymentPart
                      title="Deposit"
                      amount={payment.downPaymentAmount}
                      status={payment.downPaymentStatus}
                      dueDate={payment.downPaymentDueDate}
                    />
                  )}
                  {hasBalance && (
                    <PaymentPart
                      title="Balance"
                      amount={payment.finalPaymentAmount}
                      status={payment.finalPaymentStatus}
                      dueDate={payment.finalPaymentDueDate}
                    />
                  )}
                </div>
              )}

              <div className="payment-card-foot">
                <span className="payment-card-method">
                  <CreditCard size={16} aria-hidden="true" />
                  {methodLabel(payment.method)}
                  {payment.paidAt ? ` · ${formatCustomerDate(payment.paidAt)}` : ""}
                </span>

                <div className="payment-card-actions">
                  {payment.status === "PAID" && (
                    <button type="button" className="customer-secondary-btn small" onClick={() => downloadReceipt(payment)}>
                      Download receipt
                    </button>
                  )}
                  <Link
                    to={`/customer/bookings/${bookingId}`}
                    className="customer-secondary-btn small"
                  >
                    View booking
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <ListPagination pagination={pagination} label="payments" listId="payment-list" />

      {!payments.length && !error && (
        <div className="customer-empty-state">
          <h3>No payments yet</h3>
          <p>Completed or pending payments will appear here.</p>
        </div>
      )}
    </div>
  );
}