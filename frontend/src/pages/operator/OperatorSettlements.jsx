import { useEffect, useState } from "react";
import {
  CreditCard,
  Download,
  Receipt,
  Wallet,
  Percent,
} from "lucide-react";
import { getToken } from "../../utils/session";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

function formatMoney(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OperatorSettlements() {
  const [data, setData] = useState({
    summary: { gross: 0, discount: 0, commission: 0, processingFee: 0, net: 0 },
    settlements: [],
    payouts: [],
    platformFeePercent: 10,
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);  
  const [bookingModalLoading, setBookingModalLoading] = useState(false);
  const [bookingModalError, setBookingModalError] = useState("");

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  async function loadSettlements() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const res = await fetch(`${API_BASE}/operators/settlements`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to load settlement data");
      }

      setData(json);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || "Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(loadSettlements);
  }, []);

  async function downloadCsv() {
    try {
      setDownloading(true);
      const token = getToken();
      const res = await fetch(`${API_BASE}/operators/settlements/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to export settlement report");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `operator-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to export settlement report");
    } finally {
      setDownloading(false);
    }
  }

  const summary = data.summary || { gross: 0, discount: 0, commission: 0, processingFee: 0, net: 0 };
  const settlements = data.settlements || [];
  const payouts = data.payouts || [];

  const totalPages = Math.max(
  1,
  Math.ceil(settlements.length / rowsPerPage)
);

const paginatedSettlements = settlements.slice(
  (currentPage - 1) * rowsPerPage,
  currentPage * rowsPerPage
);

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  setCurrentPage(page);
}

  async function openBookingDetails(bookingId) {
  try {
    setBookingModalOpen(true);
    setBookingModalLoading(true);
    setBookingModalError("");
    setSelectedBooking(null);

    const token = getToken();

    const res = await fetch(`${API_BASE}/operators/bookings/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response. Status: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(json.message || "Failed to load booking details");
    }

    setSelectedBooking(json.booking);
  } catch (err) {
    setBookingModalError(err.message || "Failed to load booking details");
  } finally {
    setBookingModalLoading(false);
  }
}

function closeBookingDetails() {
  setBookingModalOpen(false);
  setSelectedBooking(null);
  setBookingModalError("");
}

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">Operator Settlement</p>
          <h1>Payout Ledger</h1>
          <p>
            Reconcile each booking against its recorded payout.
          </p>
        </div>
      </section>

      {error && <div className="operator-alert danger">{error}</div>}

      <section className="operator-metric-grid five">
        <div className="operator-metric">
          <span>Gross</span>
          <strong>{formatMoney(summary.gross)}</strong>
          <small>Before discount</small>
        </div>

        <div className="operator-metric">
          <span>Discounts</span>
          <strong>{formatMoney(summary.discount)}</strong>
          <small>Funding source shown per line</small>
        </div>

        <div className="operator-metric">
          <span>Commission</span>
          <strong>{formatMoney(summary.commission)}</strong>
          <small>Snapshotted per payment</small>
        </div>

        <div className="operator-metric">
          <span>Processing Fees</span>
          <strong>{formatMoney(summary.processingFee)}</strong>
          <small>Stripe fee, separate</small>
        </div>

        <div className="operator-metric">
          <span>Operator Net</span>
          <strong>{formatMoney(summary.net)}</strong>
          <small>Recorded payout amount</small>
        </div>
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>Payouts</h2>
            <p>Each payout lists the booking lines included in its transfer.</p>
          </div>
        </div>

        {payouts.length === 0 ? (
          <div className="operator-empty-state">No payout transfers recorded yet.</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Bookings</th>
                  <th>Stripe Transfer</th>
                  <th>Transferred</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.payoutId}>
                    <td>#{payout.payoutId}</td>
                    <td>{payout.status}</td>
                    <td>{formatMoney(payout.amount)}</td>
                    <td>
                      {payout.bookings.map((booking) => (
                        <div key={booking.ledgerEntryId}>
                          <button
                            type="button"
                            className="settlement-booking-link"
                            onClick={() => openBookingDetails(booking.bookingId)}
                          >
                            {booking.bookingCode}
                          </button>
                          <small>{booking.paymentType}</small>
                        </div>
                      ))}
                    </td>
                    <td><small>{payout.stripeTransferId || "-"}</small></td>
                    <td>{formatDate(payout.transferredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>Settlement Details</h2>
            <p>Amounts and funding source are read from the payment-time ledger snapshot.</p>
          </div>

          <div className="operator-settlement-actions">
            <button
              className="operator-secondary-btn"
              onClick={downloadCsv}
              disabled={downloading}
            >
              <Download size={16} aria-hidden="true" />
              {downloading ? "Exporting..." : "Export CSV"}
            </button>
            <button className="operator-secondary-btn" onClick={loadSettlements}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading settlement data...</div>
        ) : settlements.length === 0 ? (
          <div className="operator-empty-state">
            No commission ledger entries found.
          </div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Gross</th>
                  <th>Discount / Funder</th>
                  <th>Commission</th>
                  <th>Processing Fee</th>
                  <th>Operator Net</th>
                  <th>Payout</th>
                  <th>Transaction</th>
                  <th>Paid At</th>
                </tr>
              </thead>

              <tbody>
                {paginatedSettlements.map((item) => (
                  <tr key={item.ledgerEntryId}>
                    <td>
                        <button
                            type="button"
                            className="settlement-booking-link"
                            onClick={() => openBookingDetails(item.bookingId)}
                        >
                            {item.bookingCode}
                        </button>
                        <small>{item.serviceName}</small>
                        </td>

                    <td>
                      <strong>{item.customerName}</strong>
                      <small>{item.customerEmail || "-"}</small>
                    </td>

                    <td>{item.paymentType}</td>
                    <td>{formatMoney(item.gross)}</td>

                    <td>
                      <strong>{formatMoney(item.discount)}</strong>
                      <small>{item.fundedBy}-funded</small>
                    </td>

                    <td>
                      <strong>{formatMoney(item.commission)}</strong>
                      <small>{(item.feeRateBps / 100).toFixed(2)}% snapshotted</small>
                    </td>

                    <td>{formatMoney(item.processingFee)}</td>

                    <td>
                      <strong>{formatMoney(item.net)}</strong>
                    </td>

                    <td>{item.payoutId ? `#${item.payoutId} ${item.payoutStatus}` : "Not paid out"}</td>

                    <td>
                      <small>{item.transactionId || "-"}</small>
                    </td>

                    <td>{formatDate(item.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="operator-pagination">
              <span>
                Showing {(currentPage - 1) * rowsPerPage + 1}-
                {Math.min(currentPage * rowsPerPage, settlements.length)} of{" "}
                {settlements.length}
              </span>

              <div className="operator-pagination-actions">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, index) => {
                  const page = index + 1;

                  return (
                    <button
                      key={page}
                      type="button"
                      className={currentPage === page ? "active" : ""}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>How this is calculated</h2>
            <p>Formula used for the merchant settlement calculation.</p>
          </div>
        </div>

        <div className="operator-settlement-formula">
          <div>
            <CreditCard size={22} />
            <span>Gross</span>
            <strong>Ledger gross before discounts</strong>
          </div>

          <div>
            <Percent size={22} />
            <span>Commission</span>
            <strong>Recorded at the snapshotted fee rate and funding source</strong>
          </div>

          <div>
            <Receipt size={22} />
            <span>Processing Fee</span>
            <strong>Stripe fee stored separately from commission</strong>
          </div>

          <div>
            <Wallet size={22} />
            <span>Operator Net</span>
            <strong>Actual ledger amount assigned to the payout</strong>
          </div>
        </div>
      </section>
      {bookingModalOpen && (
  <div className="booking-modal-overlay" onClick={closeBookingDetails}>
    <div
      className="booking-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="booking-modal-head">
        <div>
          <p className="operator-eyebrow">Booking Details</p>
          <h2>{selectedBooking?.bookingCode || "Booking"}</h2>
        </div>

        <button
          type="button"
          className="booking-modal-close"
          onClick={closeBookingDetails}
        >
          ×
        </button>
      </div>

      {bookingModalLoading && (
        <div className="operator-empty-state">Loading booking details...</div>
      )}

      {bookingModalError && (
        <div className="operator-alert danger">{bookingModalError}</div>
      )}

      {!bookingModalLoading && selectedBooking && (
        <div className="booking-modal-grid">
          <section className="booking-modal-card">
            <div className="booking-modal-status-row">
              <h3>{selectedBooking.bookingCode}</h3>
              <span className="booking-status-pill">
                {selectedBooking.status}
              </span>
            </div>

            <p className="booking-muted">
              Requested on{" "}
              {selectedBooking.createdAt
                ? new Date(selectedBooking.createdAt).toLocaleString("en-MY", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "-"}
            </p>

            <h4>{selectedBooking.serviceName}</h4>
            <p className="booking-muted">{selectedBooking.serviceType || "Service"}</p>

            <div className="booking-info-list">
              <div>
                <span>Booking Date</span>
                <strong>
                  {selectedBooking.pickupDate
                    ? new Date(selectedBooking.pickupDate).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "-"}
                </strong>
              </div>

              <div>
                <span>Return / Check-out</span>
                <strong>
                  {selectedBooking.returnDate
                    ? new Date(selectedBooking.returnDate).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "-"}
                </strong>
              </div>

              <div>
                <span>Location</span>
                <strong>{selectedBooking.location || "-"}</strong>
              </div>

              <div>
                <span>Total Amount</span>
                <strong>{formatMoney(selectedBooking.totalAmount)}</strong>
              </div>

              <div>
                <span>Payment Deadline</span>
                <strong>
                  {selectedBooking.paymentDeadline
                    ? new Date(selectedBooking.paymentDeadline).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "-"}
                </strong>
              </div>
            </div>
          </section>

          <section className="booking-modal-card">
            <h3>Customer Information</h3>
            <h4>{selectedBooking.customer?.name || "Customer"}</h4>
            <p className="booking-muted">{selectedBooking.customer?.email || "-"}</p>

            <h3>Booking Information</h3>
            <div className="booking-info-list">
              <div>
                <span>Created By</span>
                <strong>{selectedBooking.operator?.companyName || "-"}</strong>
              </div>

              <div>
                <span>Operator Email</span>
                <strong>{selectedBooking.operator?.email || "-"}</strong>
              </div>

              <div>
                <span>Updated At</span>
                <strong>
                  {selectedBooking.updatedAt
                    ? new Date(selectedBooking.updatedAt).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "-"}
                </strong>
              </div>
            </div>
          </section>

          <section className="booking-modal-card">
            <h3>Payment Status</h3>

            <div className="booking-info-list">
              <div>
                <span>Amount</span>
                <strong>{formatMoney(selectedBooking.payment?.amount || selectedBooking.totalAmount)}</strong>
              </div>

              <div>
                <span>Payment Status</span>
                <strong>{selectedBooking.payment?.status || "UNPAID"}</strong>
              </div>

              <div>
                <span>Transaction ID</span>
                <strong>{selectedBooking.payment?.transactionId || "-"}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  </div>
)}
    </div>
  );
}