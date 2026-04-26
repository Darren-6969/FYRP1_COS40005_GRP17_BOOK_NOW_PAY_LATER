import { Link } from "react-router-dom";
import { useCustomerInvoices } from "../../hooks/useInvoices";
import { customerStatusClass, formatCustomerDate, formatMoney, statusLabel } from "../../utils/customerUtils";

export default function CustomerInvoices() {
  const { invoices, loading, error } = useCustomerInvoices();

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading invoices...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Invoices</p>
          <h1>Customer invoices and receipts</h1>
          <p>Invoices are generated after successful payment or receipt approval.</p>
        </div>
      </section>

      {error && <div className="customer-alert customer-alert-danger">{error}</div>}

      <section className="customer-card-grid two">
        {invoices.map((invoice) => (
          <article key={invoice.id} className="customer-glass-card invoice-card">
            <div className="customer-card-head">
              <span className={`customer-status status-${customerStatusClass(invoice.status)}`}>{statusLabel(invoice.status)}</span>
              <span>{invoice.invoiceNo}</span>
            </div>
            <h3>{invoice.booking?.operator?.companyName || "Host Invoice"}</h3>
            <div className="customer-info-list">
              <div><span>Service</span><strong>{invoice.booking?.serviceName}</strong></div>
              <div><span>Issued</span><strong>{formatCustomerDate(invoice.issuedAt)}</strong></div>
              <div><span>Amount</span><strong>{formatMoney(invoice.amount)}</strong></div>
            </div>
            <div className="customer-card-actions">
              <Link className="customer-secondary-btn" to={`/customer/bookings/${invoice.bookingId}`}>Booking</Link>
              <button className="customer-primary-btn" onClick={() => window.print()}>Download PDF</button>
            </div>
          </article>
        ))}
      </section>

      {!invoices.length && !error && <div className="customer-empty-state"><h3>No invoices yet</h3><p>Your invoices will appear after successful payment confirmation.</p></div>}
    </div>
  );
}
