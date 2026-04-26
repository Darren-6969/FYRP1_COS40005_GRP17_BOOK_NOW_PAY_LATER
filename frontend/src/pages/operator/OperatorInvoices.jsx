import { useEffect, useState } from "react";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDate,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getInvoices();
      const list = res.data.invoices || [];

      setInvoices(list);
      setSelectedInvoice(list[0] || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleSendInvoice = async (id) => {
    try {
      setActionLoading(id);
      await operatorService.sendInvoice(id);
      await loadInvoices();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send invoice");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Invoice Management</h1>
          <p>View, download, and send invoices to customers.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadInvoices}>Retry</button>
        </div>
      )}

      <section className="operator-invoice-grid">
        <div className="operator-card">
          {loading ? (
            <div className="operator-empty-state">Loading invoices...</div>
          ) : (
            <div className="operator-table-wrap">
              <table className="operator-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Issue Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNo}</td>
                      <td>{invoice.bookingId}</td>
                      <td>{invoice.booking?.customer?.name || "-"}</td>
                      <td>{formatOperatorDate(invoice.issuedAt)}</td>
                      <td>{formatOperatorMoney(invoice.amount)}</td>
                      <td>
                        <span className={`operator-status ${operatorStatusClass(invoice.status)}`}>
                          {operatorStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td>
                        <div className="operator-table-actions">
                          <button type="button" onClick={() => setSelectedInvoice(invoice)}>
                            View
                          </button>

                          <button
                            type="button"
                            disabled={!!actionLoading}
                            onClick={() => handleSendInvoice(invoice.id)}
                          >
                            Send
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!invoices.length && (
                <div className="operator-empty-state">
                  No invoices found from backend.
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="operator-card operator-invoice-preview">
          <h2>Invoice Preview</h2>

          {selectedInvoice ? (
            <>
              <Info label="Invoice No" value={selectedInvoice.invoiceNo} />
              <Info label="Booking ID" value={selectedInvoice.bookingId} />
              <Info label="Customer" value={selectedInvoice.booking?.customer?.name || "-"} />
              <Info label="Status" value={operatorStatusLabel(selectedInvoice.status)} />
              <Info label="Total" value={formatOperatorMoney(selectedInvoice.amount)} strong />

              {selectedInvoice.pdfUrl && (
                <a className="operator-secondary-btn" href={selectedInvoice.pdfUrl} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              )}
            </>
          ) : (
            <div className="operator-empty-state">Select an invoice to preview.</div>
          )}
        </aside>
      </section>
    </div>
  );
}

function Info({ label, value, strong }) {
  return (
    <div className="operator-info-row">
      <span>{label}</span>
      <strong className={strong ? "strong" : ""}>{value}</strong>
    </div>
  );
}