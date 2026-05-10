import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCustomerInvoiceById } from "../../services/customer_service";
import { downloadElementAsPdf } from "../../utils/pdfUtils";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";

function normalize(value) {
  return String(value || "").toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function getInvoiceStatus(invoice) {
  const invoiceStatus = normalize(invoice?.displayStatus || invoice?.status);
  const paymentStatus = normalize(invoice?.booking?.payment?.status);
  const bookingStatus = normalize(invoice?.booking?.status);

  if (paymentStatus === "PAID" || ["PAID", "COMPLETED", "CONFIRMED"].includes(bookingStatus)) {
    return "PAID";
  }

  if (["CANCELLED", "VOID"].includes(invoiceStatus)) return "VOID";

  if (["OVERDUE", "EXPIRED"].includes(invoiceStatus) || ["OVERDUE", "EXPIRED"].includes(bookingStatus)) {
    return "OVERDUE";
  }

  if (paymentStatus === "PENDING_VERIFICATION") {
    return "PENDING_VERIFICATION";
  }

  return invoiceStatus || "UNPAID";
}

function canPayInvoice(invoice) {
  const invoiceStatus = getInvoiceStatus(invoice);
  const paymentStatus = normalize(invoice?.booking?.payment?.status);
  const bookingStatus = normalize(invoice?.booking?.status);

  if (["PAID", "VOID", "CANCELLED", "OVERDUE", "EXPIRED"].includes(invoiceStatus)) return false;
  if (["PAID", "COMPLETED", "CONFIRMED", "CANCELLED", "REJECTED", "OVERDUE", "EXPIRED"].includes(bookingStatus)) return false;
  if (paymentStatus === "PENDING_VERIFICATION") return false;

  return true;
}

function statusClass(status) {
  const value = normalize(status);

  if (value === "PAID") return "success";
  if (value === "PENDING_VERIFICATION") return "warning";
  if (value === "OVERDUE") return "danger";
  if (value === "VOID") return "muted";

  return "info";
}

function statusLabel(status) {
  const value = normalize(status);

  if (value === "PENDING_VERIFICATION") return "Pending Verification";
  if (value === "SENT" || value === "GENERATED") return "Unpaid";
  if (value === "PAID") return "Paid";
  if (value === "OVERDUE") return "Overdue";
  if (value === "VOID") return "Void";

  return value.replaceAll("_", " ");
}

export default function CustomerInvoiceDetail() {
  const { id } = useParams();
  const documentRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInvoice = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await getCustomerInvoiceById(id);
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const invoiceStatus = getInvoiceStatus(invoice);
  const booking = invoice?.booking;
  const operator = booking?.operator;
  const payment = booking?.payment;

  const paymentSummary = useMemo(() => {
    const subtotal = Number(invoice?.amount || booking?.totalAmount || 0);
    const amountPaid = normalize(payment?.status) === "PAID" ? Number(payment?.amount || 0) : 0;
    const balanceRemaining = Math.max(subtotal - amountPaid, 0);
    const totalAmountDue = balanceRemaining || subtotal;

    return {
      subtotal,
      amountPaid,
      balanceRemaining,
      totalAmountDue,
    };
  }, [invoice, booking, payment]);

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="customer-page">
        <div className="customer-alert customer-alert-danger">
          {error || "Invoice not found"}{" "}
          <button type="button" onClick={loadInvoice}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <div className="customer-detail-topline">
        <Link className="customer-back-link" to="/customer/invoices">
          ← Back to Invoices
        </Link>

        <div className="customer-invoice-detail-actions">
          <button
            type="button"
            className="customer-secondary-btn small"
            onClick={() =>
              downloadElementAsPdf(
                documentRef.current,
                `${invoice.invoiceNo || "invoice"}.pdf`
              )
            }
          >
            Download PDF
          </button>

          {canPayInvoice(invoice) && (
            <Link
              className="customer-primary-btn small"
              to={`/customer/checkout/${invoice.bookingId || booking?.id}`}
            >
              Pay Invoice
            </Link>
          )}
        </div>
      </div>

      <section className="customer-invoice-preview-card">
        <div ref={documentRef} className="pdf-document customer-invoice-document">
          <div className="document-header">
            <div>
              {operator?.logoUrl ? (
                <img
                  className="document-logo"
                  src={operator.logoUrl}
                  alt="Merchant logo"
                />
              ) : (
                <div className="document-logo-placeholder">BNPL</div>
              )}

              <h2>Invoice</h2>
              <p>{operator?.companyName || "Host / Merchant"}</p>
              <p>
                {operator?.email || "-"}
                {operator?.phone ? ` · ${operator.phone}` : ""}
              </p>
            </div>

            <div className="document-meta">
              <strong>{invoice.invoiceNo}</strong>
              <span>Issue Date: {formatCustomerDate(invoice.issuedAt)}</span>
              <span>
                Due Date:{" "}
                {booking?.paymentDeadline
                  ? formatCustomerDate(booking.paymentDeadline)
                  : "-"}
              </span>
              <span
                className={`customer-status status-${statusClass(invoiceStatus)}`}
              >
                {statusLabel(invoiceStatus)}
              </span>
            </div>
          </div>

          <div className="document-grid">
            <section>
              <h4>Bill To</h4>
              <p>{booking?.customer?.name || "Customer"}</p>
              <p>{booking?.customer?.email || "-"}</p>
            </section>

            <section>
              <h4>Invoice Details</h4>
              <p>Invoice No.: {invoice.invoiceNo}</p>
              <p>Booking Ref: {booking?.bookingCode || `BNPL-${booking?.id}`}</p>
              <p>Status: {statusLabel(invoiceStatus)}</p>
            </section>
          </div>

          <section className="document-section">
            <h4>Booking Summary</h4>
            <table className="table document-table">
              <tbody>
                <tr>
                  <td>Booking Reference</td>
                  <td>{booking?.bookingCode || `BNPL-${booking?.id}`}</td>
                </tr>
                <tr>
                  <td>Service Description</td>
                  <td>{booking?.serviceName || "-"}</td>
                </tr>
                <tr>
                  <td>Service Type</td>
                  <td>{booking?.serviceType || "-"}</td>
                </tr>
                <tr>
                  <td>Pick-up / Check-in</td>
                  <td>{formatDateTime(booking?.pickupDate)}</td>
                </tr>
                <tr>
                  <td>Return / Check-out</td>
                  <td>{formatDateTime(booking?.returnDate)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="document-section">
            <h4>Payment Breakdown</h4>
            <table className="table document-table">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td>{formatMoney(paymentSummary.subtotal)}</td>
                </tr>
                <tr>
                  <td>Amount Paid</td>
                  <td>{formatMoney(paymentSummary.amountPaid)}</td>
                </tr>
                <tr>
                  <td>Balance Remaining</td>
                  <td>{formatMoney(paymentSummary.balanceRemaining)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total Amount Due</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(paymentSummary.totalAmountDue)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="document-section">
            <h4>Payment Status</h4>
            <span className={`customer-status status-${statusClass(invoiceStatus)}`}>
              {statusLabel(invoiceStatus)}
            </span>

            <div className="document-timeline">
              <div>
                <strong>Invoice Issued</strong>
                <span>{formatDateTime(invoice.issuedAt)}</span>
              </div>

              {booking?.paymentDeadline && (
                <div>
                  <strong>Payment Deadline</strong>
                  <span>{formatDateTime(booking.paymentDeadline)}</span>
                </div>
              )}

              {payment?.paidAt && (
                <div>
                  <strong>Payment Received</strong>
                  <span>{formatDateTime(payment.paidAt)}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}