import { useEffect, useMemo, useRef, useState } from "react";
import { getReceipts } from "../../services/admin_service";
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
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

export default function Receipts() {
  const documentRef = useRef(null);

  const [receipts, setReceipts] = useState([]);
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("ALL");
  const [operator, setOperator] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getReceipts();
      setReceipts(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const operators = useMemo(() => {
    const names = new Set(receipts.map((r) => r.operatorName).filter(Boolean));
    return Array.from(names);
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter((receipt) => {
      const text = [
        receipt.receiptNo,
        receipt.customerName,
        receipt.customerEmail,
        receipt.bookingCode,
        receipt.operatorName,
        receipt.method,
        receipt.transactionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesMethod = method === "ALL" || receipt.method === method;
      const matchesOperator =
        operator === "ALL" || receipt.operatorName === operator;

      return matchesQuery && matchesMethod && matchesOperator;
    });
  }, [receipts, query, method, operator]);

  const summary = useMemo(() => {
    return {
      total: receipts.length,
      stripe: receipts.filter((r) => r.method === "STRIPE").length,
      manual: receipts.filter((r) =>
        ["DUITNOW", "SPAY", "BANK_TRANSFER"].includes(r.method)
      ).length,
      totalPaid: receipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0),
    };
  }, [receipts]);

  const downloadSelected = async () => {
    await downloadElementAsPdf(
      documentRef.current,
      `${selected?.receiptNo || "receipt"}.pdf`
    );
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Official Receipt Archive</h3>
            <p>
              Read-only official receipts generated after successful payment.
              Manual receipt verification is handled in the Payments page.
            </p>
          </div>

          <button className="btn" onClick={load}>Refresh</button>
        </div>

        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Total Receipts" value={summary.total} />
          <Stat title="Stripe Receipts" value={summary.stripe} />
          <Stat title="Manual Payment Receipts" value={summary.manual} />
          <Stat title="Total Paid" value={money(summary.totalPaid)} />
        </div>
      </section>

      <section className="card">
        <div className="admin-filter-row">
          <input
            placeholder="Search receipt no, customer, booking, operator..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="ALL">All Methods</option>
            <option value="STRIPE">Stripe</option>
            <option value="DUITNOW">DuitNow</option>
            <option value="SPAY">SPay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="PAYPAL">PayPal</option>
            <option value="CASH">Cash</option>
          </select>

          <select value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="ALL">All Operators</option>
            {operators.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading receipts...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Booking</th>
                <th>Payment Date</th>
                <th>Amount Paid</th>
                <th>Method</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((receipt) => (
                <tr key={receipt.id}>
                  <td><strong>{receipt.receiptNo}</strong></td>
                  <td>
                    {receipt.customerName}
                    <br />
                    <small>{receipt.customerEmail}</small>
                  </td>
                  <td>{receipt.operatorName}</td>
                  <td>{receipt.bookingCode}</td>
                  <td>{dateTime(receipt.paymentDate)}</td>
                  <td>{money(receipt.amountPaid)}</td>
                  <td>{receipt.method}</td>
                  <td>{money(receipt.balanceRemaining)}</td>
                  <td>
                    <div className="actions">
                      <button className="btn" onClick={() => setSelected(receipt)}>
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan="9">No official receipts found.</td>
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

                  <h2>Official Receipt</h2>
                  <p>{selected.operatorName}</p>
                  <p>
                    {selected.operatorEmail}
                    {selected.operatorPhone ? ` · ${selected.operatorPhone}` : ""}
                  </p>
                </div>

                <div className="document-meta">
                  <strong>{selected.receiptNo}</strong>
                  <span>Payment Date: {dateTime(selected.paymentDate)}</span>
                </div>
              </div>

              <div className="document-grid">
                <section>
                  <h4>Received From</h4>
                  <p>{selected.customerName}</p>
                  <p>{selected.customerEmail}</p>
                </section>

                <section>
                  <h4>Payment Detail</h4>
                  <p>Booking Ref: {selected.bookingCode}</p>
                  <p>{selected.serviceName}</p>
                  <p>Payment Method: {selected.method}</p>
                  <p>Transaction ID: {selected.transactionId}</p>
                  <p>Payment Type: {selected.paymentType}</p>
                </section>
              </div>

              <section className="document-section">
                <h4>Summary</h4>
                <table className="table document-table">
                  <tbody>
                    <tr>
                      <td>Total Booking Value</td>
                      <td>{money(selected.totalBookingValue)}</td>
                    </tr>
                    <tr>
                      <td>Amount Paid This Transaction</td>
                      <td>{money(selected.amountPaid)}</td>
                    </tr>
                    <tr>
                      <td>Amount Paid To Date</td>
                      <td>{money(selected.amountPaidToDate)}</td>
                    </tr>
                    <tr>
                      <td><strong>Balance Remaining</strong></td>
                      <td><strong>{money(selected.balanceRemaining)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <footer className="document-footer">
                This receipt is computer-generated and is valid without signature.
              </footer>
            </div>

            <div className="document-actions">
              <button className="btn" onClick={() => setSelected(null)}>
                Close
              </button>

              <button className="btn primary" onClick={downloadSelected}>
                Download as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}