import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerInvoices } from "../../hooks/useInvoices";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

function normalize(value) {
  return String(value || "").toUpperCase();
}

function getInvoiceStatus(invoice) {
  const invoiceStatus = normalize(invoice.displayStatus || invoice.status);
  const paymentStatus = normalize(invoice.booking?.payment?.status);
  const bookingStatus = normalize(invoice.booking?.status);

  if (paymentStatus === "PAID" || ["PAID", "COMPLETED", "CONFIRMED"].includes(bookingStatus)) {
    return "PAID";
  }

  if (["CANCELLED", "VOID"].includes(invoiceStatus)) {
    return "VOID";
  }

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
  const paymentStatus = normalize(invoice.booking?.payment?.status);
  const bookingStatus = normalize(invoice.booking?.status);

  if (["PAID", "VOID", "CANCELLED", "OVERDUE", "EXPIRED"].includes(invoiceStatus)) {
    return false;
  }

  if (["PAID", "COMPLETED", "CONFIRMED", "CANCELLED", "REJECTED", "OVERDUE", "EXPIRED"].includes(bookingStatus)) {
    return false;
  }

  if (paymentStatus === "PENDING_VERIFICATION") {
    return false;
  }

  return true;
}

function invoiceStatusLabel(status) {
  const value = normalize(status);

  if (value === "PENDING_VERIFICATION") return "Pending Verification";
  if (value === "GENERATED") return "Unpaid";
  if (value === "SENT") return "Unpaid";
  if (value === "PAID") return "Paid";
  if (value === "OVERDUE") return "Overdue";
  if (value === "VOID" || value === "CANCELLED") return "Void";

  return statusLabel(value);
}

function invoiceStatusClass(status) {
  const value = normalize(status);

  if (value === "PAID") return "success";
  if (value === "PENDING_VERIFICATION") return "warning";
  if (value === "OVERDUE") return "danger";
  if (value === "VOID" || value === "CANCELLED") return "muted";

  return customerStatusClass(value);
}

export default function CustomerInvoices() {
  const { invoices, loading, error, reload } = useCustomerInvoices();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceStatus = getInvoiceStatus(invoice);

      const searchableText = [
        invoice.invoiceNo,
        invoice.bookingCode,
        invoice.booking?.bookingCode,
        invoice.booking?.serviceName,
        invoice.booking?.operator?.companyName,
        invoice.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || searchableText.includes(query.toLowerCase());

      const matchesStatus =
        filterStatus === "ALL" || invoiceStatus === filterStatus;

      return matchesQuery && matchesStatus;
    });
  }, [invoices, query, filterStatus]);

  const stats = useMemo(() => {
    const paid = invoices.filter((invoice) => getInvoiceStatus(invoice) === "PAID").length;
    const unpaid = invoices.filter((invoice) => canPayInvoice(invoice)).length;
    const overdue = invoices.filter((invoice) => getInvoiceStatus(invoice) === "OVERDUE").length;

    return {
      total: invoices.length,
      paid,
      unpaid,
      overdue,
    };
  }, [invoices]);

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Invoices</p>
          <h1>Issued payment invoices</h1>
          <p>
            View invoices issued for your accepted bookings. Open an invoice to
            preview the full document and pay only when payment is still required.
          </p>
        </div>

        <div className="customer-dashboard-stats customer-invoice-stats">
          <div className="customer-stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Unpaid</span>
            <strong>{stats.unpaid}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Paid</span>
            <strong>{stats.paid}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Overdue</span>
            <strong>{stats.overdue}</strong>
          </div>
        </div>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">
          {error} <button onClick={reload}>Retry</button>
        </div>
      )}

      <section className="customer-table-card">
        <div className="customer-table-head">
          <div>
            <h2>Invoice List</h2>
            <p>Search by invoice number, booking reference, service, or merchant.</p>
          </div>
        </div>

        <div className="customer-invoice-filter-row">
          <input
            type="search"
            placeholder="Search invoice no, booking ref, service, merchant..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="GENERATED">Unpaid</option>
            <option value="SENT">Sent / Unpaid</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="VOID">Void</option>
          </select>
        </div>

        <div className="customer-invoice-list">
          {filteredInvoices.map((invoice) => {
            const invoiceStatus = getInvoiceStatus(invoice);
            const bookingId = invoice.bookingId || invoice.booking?.id;
            const bookingCode =
              invoice.bookingCode ||
              invoice.booking?.bookingCode ||
              `BNPL-${bookingId}`;

            return (
              <article key={invoice.id} className="customer-invoice-row-card">
                <div className="customer-invoice-main">
                  <div className="customer-invoice-title-row">
                    <div>
                      <span className="customer-invoice-label">Invoice No.</span>
                      <h3>{invoice.invoiceNo}</h3>
                    </div>

                    <span
                      className={`customer-status status-${invoiceStatusClass(
                        invoiceStatus
                      )}`}
                    >
                      {invoiceStatusLabel(invoiceStatus)}
                    </span>
                  </div>

                  <div className="customer-invoice-summary-grid">
                    <div>
                      <span>Booking Ref</span>
                      <strong>{bookingCode}</strong>
                    </div>

                    <div>
                      <span>Merchant</span>
                      <strong>
                        {invoice.booking?.operator?.companyName || "Host / Merchant"}
                      </strong>
                    </div>

                    <div>
                      <span>Service</span>
                      <strong>{invoice.booking?.serviceName || "-"}</strong>
                    </div>

                    <div>
                      <span>Issued</span>
                      <strong>{formatCustomerDate(invoice.issuedAt)}</strong>
                    </div>

                    <div>
                      <span>Payment Deadline</span>
                      <strong>
                        {invoice.booking?.paymentDeadline
                          ? formatCustomerDate(invoice.booking.paymentDeadline)
                          : "-"}
                      </strong>
                    </div>

                    <div>
                      <span>Amount</span>
                      <strong>{formatMoney(invoice.amount)}</strong>
                    </div>
                  </div>
                </div>

                <div className="customer-invoice-actions">
                  <Link
                    className="customer-secondary-btn small"
                    to={`/customer/invoices/${invoice.id}`}
                  >
                    View Invoice
                  </Link>

                  <Link
                    className="customer-secondary-btn small"
                    to={`/customer/bookings/${bookingId}`}
                  >
                    Booking Details
                  </Link>

                  {canPayInvoice(invoice) && (
                    <Link
                      className="customer-primary-btn small"
                      to={`/customer/checkout/${bookingId}`}
                    >
                      Pay Invoice
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {!filteredInvoices.length && !error && (
          <div className="customer-empty-state compact">
            <h3>No invoices found</h3>
            <p>
              Your invoices will appear here after a booking is accepted and a
              payment request is issued.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}