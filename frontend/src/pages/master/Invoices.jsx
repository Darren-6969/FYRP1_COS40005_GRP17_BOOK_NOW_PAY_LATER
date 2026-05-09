import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInvoices,
  sendInvoice,
  voidInvoice,
} from "../../services/admin_service";
import { downloadElementAsPdf } from "../../utils/pdfUtils";

function money(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
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
  const [operator, setOperator] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getInvoices();
      setInvoices(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const operators = useMemo(() => {
    const names = new Set(invoices.map((i) => i.operatorName).filter(Boolean));
    return Array.from(names);
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceStatus = invoice.displayStatus || invoice.status;

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
      const matchesStatus = status === "ALL" || invoiceStatus === status;
      const matchesOperator =
        operator === "ALL" || invoice.operatorName === operator;

      return matchesQuery && matchesStatus && matchesOperator;
    });
  }, [invoices, query, status, operator]);

  const summary = useMemo(() => {
    return {
      total: invoices.length,
      paid: invoices.filter((i) => i.displayStatus === "PAID").length,
      unpaid: invoices.filter((i) =>
        ["GENERATED", "SENT"].includes(i.displayStatus || i.status)
      ).length,
      overdue: invoices.filter((i) => i.displayStatus === "OVERDUE").length,
      voided: invoices.filter((i) =>
        ["VOID", "CANCELLED"].includes(i.displayStatus || i.status)
      ).length,
      amountDue: invoices.reduce(
        (sum, i) => sum + Number(i.balanceRemaining || i.totalAmountDue || 0),
        0
      ),
    };
  }, [invoices]);

  const handleSend = async (invoice) => {
    try {
      setActionLoading(`send-${invoice.id}`);
      setMessage("");
      setError("");

      await sendInvoice(invoice.id);

      setMessage(`Invoice ${invoice.invoiceNo} resent successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend invoice.");
    } finally {
      setActionLoading("");
    }
  };

  const handleVoid = async (invoice) => {
    const displayStatus = invoice.displayStatus || invoice.status;

    if (displayStatus === "PAID") {
      alert("Paid invoices should not be voided from the dashboard.");
      return;
    }

    if (!window.confirm(`Void invoice ${invoice.invoiceNo}?`)) {
      return;
    }

    try {
      setActionLoading(`void-${invoice.id}`);
      setMessage("");
      setError("");

      await voidInvoice(invoice.id);

      setMessage(`Invoice ${invoice.invoiceNo} marked as void.`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to void invoice.");
    } finally {
      setActionLoading("");
    }
  };

  const downloadSelected = async () => {
    await downloadElementAsPdf(
      documentRef.current,
      `${selected?.invoiceNo || "invoice"}.pdf`
    );
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Invoice Management</h3>
            <p>
              View, resend, download, and void invoices across all operators.
            </p>
          </div>

          <button className="btn" onClick={load}>Refresh</button>
        </div>

        {message && <div className="alert">{message}</div>}
        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Total Invoices" value={summary.total} />
          <Stat title="Paid" value={summary.paid} />
          <Stat title="Unpaid / Sent" value={summary.unpaid} />
          <Stat title="Overdue" value={summary.overdue} danger={summary.overdue > 0} />
          <Stat title="Void" value={summary.voided} />
          <Stat title="Amount Due" value={money(summary.amountDue)} />
        </div>
      </section>

      <section className="card">
        <div className="admin-filter-row">
          <input
            placeholder="Search customer, booking ref, invoice no, operator..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="GENERATED">Generated</option>
            <option value="SENT">Sent</option>
            <option value="VOID">Void</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="ALL">All Operators</option>
            {operators.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading invoices...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Booking</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((invoice) => {
                const invoiceStatus = invoice.displayStatus || invoice.status;
                const isPaid = invoiceStatus === "PAID";

                return (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoiceNo}</strong></td>
                    <td>
                      {invoice.customerName}
                      <br />
                      <small>{invoice.customerEmail}</small>
                    </td>
                    <td>{invoice.operatorName}</td>
                    <td>{invoice.bookingCode}</td>
                    <td>{dateTime(invoice.issuedAt)}</td>
                    <td>{dateTime(invoice.dueDate)}</td>
                    <td>{money(invoice.amount)}</td>
                    <td>{money(invoice.balanceRemaining)}</td>
                    <td>
                      <span className={`invoice-status ${statusClass(invoiceStatus)}`}>
                        {String(invoiceStatus).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn" onClick={() => setSelected(invoice)}>
                          View
                        </button>

                        <button
                          className="btn primary"
                          disabled={!!actionLoading}
                          onClick={() => handleSend(invoice)}
                        >
                          Resend
                        </button>

                        <button
                          className="btn danger"
                          disabled={isPaid || !!actionLoading}
                          title={isPaid ? "Paid invoice cannot be voided" : "Void invoice"}
                          onClick={() => handleVoid(invoice)}
                        >
                          Void
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan="10">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-document-modal" onClick={(event) => event.stopPropagation()}>
            <div ref={documentRef} className="pdf-document">
              <div className="document-header">
                <div>
                  {selected.operatorLogoUrl ? (
                    <img className="document-logo" src={selected.operatorLogoUrl} alt="Merchant logo" />
                  ) : (
                    <div className="document-logo-placeholder">BNPL</div>
                  )}

                  <h2>Invoice</h2>
                  <p>{selected.operatorName}</p>
                  <p>
                    {selected.operatorEmail}
                    {selected.operatorPhone ? ` · ${selected.operatorPhone}` : ""}
                  </p>
                </div>

                <div className="document-meta">
                  <strong>{selected.invoiceNo}</strong>
                  <span>Issue Date: {dateTime(selected.issuedAt)}</span>
                  <span>Due Date: {dateTime(selected.dueDate)}</span>
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
                  <p>Pickup: {dateTime(selected.booking?.pickupDate)}</p>
                  <p>Return: {dateTime(selected.booking?.returnDate)}</p>
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
                      <td>Amount Paid</td>
                      <td>{money(selected.amountPaid)}</td>
                    </tr>
                    <tr>
                      <td>Balance Remaining</td>
                      <td>{money(selected.balanceRemaining)}</td>
                    </tr>
                    <tr>
                      <td><strong>Total Amount Due</strong></td>
                      <td><strong>{money(selected.totalAmountDue)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="document-section">
                <h4>Status</h4>
                <span className={`invoice-status ${statusClass(selected.displayStatus || selected.status)}`}>
                  {selected.displayStatus || selected.status}
                </span>
              </section>
            </div>

            <div className="document-actions">
              <button className="btn" onClick={() => setSelected(null)}>
                Close
              </button>

              <button className="btn" onClick={downloadSelected}>
                Download PDF
              </button>

              <button className="btn primary" onClick={() => handleSend(selected)}>
                Resend Email
              </button>

              <button
                className="btn danger"
                disabled={(selected.displayStatus || selected.status) === "PAID"}
                onClick={() => handleVoid(selected)}
              >
                Void Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, danger }) {
  return (
    <div className={`stat-card ${danger ? "danger" : ""}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}