import { useEffect, useMemo, useRef, useState } from "react";
import { getReceipts } from "../../services/admin_service";
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

export default function Receipts() {
  const documentRef = useRef(null);

  const [receipts, setReceipts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [method, setMethod] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await getReceipts();
    setReceipts(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return receipts.filter((receipt) => {
      const matchesMethod = method === "ALL" || receipt.method === method;

      const text = [
        receipt.receiptNo,
        receipt.customerName,
        receipt.customerEmail,
        receipt.bookingCode,
        receipt.method,
        receipt.transactionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());

      return matchesMethod && matchesQuery;
    });
  }, [receipts, method, query]);

  const handleDownloadSelected = async () => {
    await downloadElementAsPdf(
      documentRef.current,
      `${selected?.receiptNo || "receipt"}.pdf`
    );
  };

  const handleDownloadFromRow = async (receipt) => {
    setSelected(receipt);

    setTimeout(async () => {
      await downloadElementAsPdf(
        documentRef.current,
        `${receipt.receiptNo || "receipt"}.pdf`
      );
    }, 150);
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Receipt List</h3>
            <p>Read-only receipts generated from completed payment events.</p>
          </div>
        </div>

        <div className="admin-filter-row invoice-filter-row">
          <input
            placeholder="Search receipt no, customer, booking ref..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="ALL">All Methods</option>
            <option value="PAYPAL">PayPal</option>
            <option value="STRIPE">Stripe</option>
            <option value="DUITNOW">DuitNow</option>
            <option value="SPAY">SPay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading receipts...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Customer</th>
                <th>Booking Ref</th>
                <th>Payment Date</th>
                <th>Amount Paid</th>
                <th>Method</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((receipt) => (
                <tr key={receipt.id}>
                  <td>
                    <strong>{receipt.receiptNo}</strong>
                  </td>
                  <td>{receipt.customerName}</td>
                  <td>{receipt.bookingCode}</td>
                  <td>{date(receipt.paymentDate)}</td>
                  <td>{money(receipt.amountPaid)}</td>
                  <td>{receipt.method}</td>
                  <td>{receipt.paymentType}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn"
                        onClick={() => setSelected(receipt)}
                      >
                        View
                      </button>

                      <button
                        className="btn"
                        onClick={() => handleDownloadFromRow(receipt)}
                      >
                        Download PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan="8">No completed payment receipts found.</td>
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

                  <h2>Official Receipt</h2>
                  <p>{selected.operatorName}</p>
                  <p>
                    {selected.operatorEmail}{" "}
                    {selected.operatorPhone ? `· ${selected.operatorPhone}` : ""}
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
                      <td>
                        <strong>Balance Remaining</strong>
                      </td>
                      <td>
                        <strong>{money(selected.balanceRemaining)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <footer className="document-footer">
                This receipt is computer-generated and is valid without
                signature.
              </footer>
            </div>

            <div className="document-actions">
              <button className="btn" onClick={() => setSelected(null)}>
                Close
              </button>

              <button className="btn primary" onClick={handleDownloadSelected}>
                Download as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}