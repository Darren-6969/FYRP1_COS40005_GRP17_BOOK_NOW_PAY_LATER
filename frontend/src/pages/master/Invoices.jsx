import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInvoices,
  sendInvoice,
  voidInvoice,
} from "../../services/invoice_service";
import { downloadElementAsPdf } from "../../utils/pdfUtils";

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function date(value) {
  return value ? new Date(value).toLocaleDateString("en-MY") : "-";
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-MY") : "-";
}

function statusClass(status) {
  const s = String(status || "").toUpperCase();

  if (s === "PAID") return "paid";
  if (s === "PARTIAL") return "partial";
  if (s === "OVERDUE") return "overdue";
  if (s === "VOID" || s === "CANCELLED") return "void";
  return "unpaid";
}

export default function Invoices() {
  const documentRef = useRef(null);

  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await getInvoices();
    setInvoices(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceStatus = invoice.displayStatus || invoice.status;
      const matchesStatus = status === "ALL" || invoiceStatus === status;

      const text = [
        invoice.invoiceNo,
        invoice.customerName,
        invoice.customerEmail,
        invoice.bookingCode,
        invoice.operatorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [invoices, query, status]);

  const handleSend = async (id) => {
    await sendInvoice(id);
    await load();
    alert("Invoice email resent successfully.");
  };

  const handleVoid = async (id) => {
    if (!window.confirm("Void this invoice? This is an admin override.")) {
      return;
    }

    await voidInvoice(id);
    await load();
    setSelected(null);
  };

  const handleDownloadSelected = async () => {
    await downloadElementAsPdf(
      documentRef.current,
      `${selected?.invoiceNo || "invoice"}.pdf`
    );
  };

  const handleDownloadFromRow = async (invoice) => {
    setSelected(invoice);

    setTimeout(async () => {
      await downloadElementAsPdf(
        documentRef.current,
        `${invoice.invoiceNo || "invoice"}.pdf`
      );
    }, 150);
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Invoice List</h3>
            <p>Manage invoices issued to customers for BNPL bookings.</p>
          </div>
        </div>

        <div className="admin-filter-row invoice-filter-row">
          <input
            placeholder="Search customer, booking ref, invoice no..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="GENERATED">Unpaid / Generated</option>
            <option value="VOID">Void</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading invoices...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Customer Name</th>
                <th>Booking Ref</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Quick Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((invoice) => {
                const invoiceStatus = invoice.displayStatus || invoice.status;

                return (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoiceNo}</strong>
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>{invoice.bookingCode}</td>
                    <td>{date(invoice.issuedAt)}</td>
                    <td>{date(invoice.dueDate)}</td>
                    <td>{money(invoice.amount)}</td>
                    <td>
                      <span
                        className={`invoice-status ${statusClass(invoiceStatus)}`}
                      >
                        {String(invoiceStatus).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn"
                          onClick={() => setSelected(invoice)}
                        >
                          View
                        </button>

                        <button
                          className="btn"
                          onClick={() => handleDownloadFromRow(invoice)}
                        >
                          Download PDF
                        </button>

                        <button
                          className="btn primary"
                          onClick={() => handleSend(invoice.id)}
                        >
                          Resend Email
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan="8">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="admin-document-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div ref={documentRef} className="pdf-document">
              <div className="document-header">
                <div>
                  {selected.operatorLogoUrl ? (
                    <img
                      className="document-logo"
                      src={selected.operatorLogoUrl}
                      alt="Merchant logo"
                    />
                  ) : (
                    <div className="document-logo-placeholder">BNPL</div>
                  )}

                  <h2>Invoice</h2>
                  <p>{selected.operatorName}</p>
                  <p>
                    {selected.operatorEmail}{" "}
                    {selected.operatorPhone ? `· ${selected.operatorPhone}` : ""}
                  </p>
                </div>

                <div className="document-meta">
                  <strong>{selected.invoiceNo}</strong>
                  <span>Issue Date: {date(selected.issuedAt)}</span>
                  <span>Due Date: {date(selected.dueDate)}</span>
                </div>
              </div>

              <div className="document-grid">
                <section>
                  <h4>Bill To</h4>
                  <p>{selected.customerName}</p>
                  <p>{selected.customerEmail}</p>
                </section>

                <section>
                  <h4>Booking Summary</h4>
                  <p>Booking Ref: {selected.bookingCode}</p>
                  <p>{selected.booking?.serviceName}</p>
                  <p>
                    Pickup: {dateTime(selected.booking?.pickupDate)}
                    <br />
                    Return: {dateTime(selected.booking?.returnDate)}
                  </p>
                </section>
              </div>

              <section className="document-section">
                <h4>Payment Breakdown</h4>
                <table className="table document-table">
                  <tbody>
                    <tr>
                      <td>Subtotal</td>
                      <td>{money(selected.subtotal)}</td>
                    </tr>
                    <tr>
                      <td>Deposit Required / Paid</td>
                      <td>
                        {money(selected.depositRequired || selected.amountPaid)}
                      </td>
                    </tr>
                    <tr>
                      <td>Balance Remaining</td>
                      <td>{money(selected.balanceRemaining)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Total Amount Due</strong>
                      </td>
                      <td>
                        <strong>{money(selected.totalAmountDue)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="document-section">
                <h4>Payment Status</h4>
                <span
                  className={`invoice-status ${statusClass(
                    selected.displayStatus || selected.status
                  )}`}
                >
                  {selected.displayStatus || selected.status}
                </span>

                <div className="document-timeline">
                  <div>
                    <strong>Invoice Issued</strong>
                    <span>{dateTime(selected.issuedAt)}</span>
                  </div>

                  {selected.booking?.payment?.paidAt && (
                    <div>
                      <strong>Payment Received</strong>
                      <span>{dateTime(selected.booking.payment.paidAt)}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="document-actions">
              <button className="btn" onClick={() => setSelected(null)}>
                Close
              </button>

              <button className="btn" onClick={handleDownloadSelected}>
                Download as PDF
              </button>

              <button
                className="btn primary"
                onClick={() => handleSend(selected.id)}
              >
                Resend Email
              </button>

              <button
                className="btn danger"
                onClick={() => handleVoid(selected.id)}
              >
                Mark as Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}