import { useEffect, useState } from "react";
import {
  CreditCard,
  DollarSign,
  Receipt,
  Wallet,
  Percent,
} from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

function getToken() {
  return (
    localStorage.getItem("bnpl_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("bnpl_token") ||
    sessionStorage.getItem("token")
  );
}

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

export default function MasterSettlements() {
  const [data, setData] = useState({
    platformFeePercent: 10,
    summary: null,
    settlements: [],
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingModalLoading, setBookingModalLoading] = useState(false);
  const [bookingModalError, setBookingModalError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Server returned non-JSON response. Status: ${res.status}. Check API URL.`
        );
      }

      if (!res.ok) {
        throw new Error(json.message || "Failed to load settlement data");
      }

      setData(json);
    } catch (err) {
      setError(err.message || "Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettlements();
  }, []);

  const settlements = data.settlements || [];

  const summary = settlements.reduce(
  (acc, item) => {
    const customerPaid = Number(
      item.customerPaid ??
      item.customer_paid ??
      item.amount ??
      item.totalAmount ??
      0
    );

    const bnplAdminFee = Number(
      item.bnplAdminFee ??
      item.platformFee ??
      item.bnplFee ??
      0
    );

    acc.totalCustomerPaid += customerPaid;
    acc.totalBnplAdminFee += bnplAdminFee;
    acc.totalActualIncome += bnplAdminFee;

    return acc;
  },
  {
    totalCustomerPaid: 0,
    totalBnplAdminFee: 0,
    totalActualIncome: 0,
  }
);
  
  /*Clickable Booking ID Details*/
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
          <p className="operator-eyebrow">Admin Settlement</p>
          <h1>BNPL Payment Breakdown</h1>
          <p>
            View total customer payments, BNPL platform commission, Stripe fee
            absorbed by BNPL, and actual BNPL earnings.
          </p>
        </div>

        <span className="operator-model-badge">
          BNPL Fee: {data.platformFeePercent || 10}%
        </span>
      </section>

      {error && <div className="operator-alert danger">{error}</div>}

      <section className="operator-metric-grid four">
        <div className="operator-metric">
        <span>Customer Paid</span>
        <strong>{formatMoney(summary.totalCustomerPaid)}</strong>
        <small>Total Stripe payments</small>
        </div>

        <div className="operator-metric">
        <span>BNPL Admin Fee</span>
        <strong>{formatMoney(summary.totalBnplAdminFee)}</strong>
        <small>{data.platformFeePercent || 10}% platform commission</small>
        </div>

        <div className="operator-metric">
        <span>Total Paid Bookings</span>
        <strong>{settlements.length}</strong>
        <small>Completed Stripe payments</small>
        </div>

        <div className="operator-metric">
        <span>Actual Income</span>
        <strong>{formatMoney(summary.totalActualIncome)}</strong>
        <small>BNPL Total Income</small>
        </div>
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>Admin Settlement Details</h2>
            <p>
              Each row is connected to a real paid booking and its Stripe
              transaction ID.
            </p>
          </div>

          <button className="operator-secondary-btn" onClick={loadSettlements}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading settlement data...</div>
        ) : settlements.length === 0 ? (
          <div className="operator-empty-state">
            No paid Stripe bookings found yet.
          </div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Merchant</th>
                  <th>Customer</th>
                  <th>Customer Paid</th>
                  <th>BNPL Admin Fee</th>
                  <th>Actual Income</th>
                  <th>Transaction</th>
                  <th>Paid At</th>
                </tr>
              </thead>

              <tbody>
                {settlements.map((item) => {
                  const customerPaid = Number(item.customerPaid || 0);
                  const bnplAdminFee = Number(item.bnplAdminFee || 0);

                  return (
                    <tr key={item.bookingId}>
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
                        <strong>{item.operatorName || "Merchant"}</strong>
                        <small>Merchant</small>
                      </td>

                      <td>
                        <strong>{item.customerName}</strong>
                        <small>{item.customerEmail || "-"}</small>
                      </td>

                      <td>{formatMoney(customerPaid)}</td>

                      <td>
                        <strong>{formatMoney(bnplAdminFee)}</strong>
                        <small>{item.platformFeePercent || 10}% platform fee</small>
                      </td>

                      <td>
                        <strong>{formatMoney(bnplAdminFee)}</strong>
                        <small>BNPL platform income</small>
                    </td>

                      <td>
                        <small>{item.transactionId || "-"}</small>
                      </td>

                      <td>{formatDate(item.paidAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
            <section className="operator-card">
            <div className="operator-card-head">
                <div>
                <h2>How this is calculated</h2>
                <p>Formula used for the admin settlement calculation.</p>
                </div>
            </div>

            <div className="operator-settlement-formula admin-formula-three">
                <div>
                <CreditCard size={22} />
                <span>Customer Paid</span>
                <strong>Full booking amount paid by customer through Stripe</strong>
                </div>

                <div>
                <Percent size={22} />
                <span>BNPL Admin Fee</span>
                <strong>Customer Paid × {data.platformFeePercent || 10}% platform commission</strong>
                </div>

                <div>
                <Wallet size={22} />
                <span>Actual Income</span>
                <strong>Same as BNPL Admin Fee</strong>
                </div>
            </div>
            </section>

{bookingModalOpen && (
  <div className="booking-modal-overlay" onClick={closeBookingDetails}>
    <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
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
            <p className="booking-muted">
              {selectedBooking.serviceType || "Service"}
            </p>

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
            <p className="booking-muted">
              {selectedBooking.customer?.email || "-"}
            </p>

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
                <strong>
                  {formatMoney(
                    selectedBooking.payment?.amount || selectedBooking.totalAmount
                  )}
                </strong>
              </div>

              <div>
                <span>Payment Status</span>
                <strong>{selectedBooking.payment?.status || "UNPAID"}</strong>
              </div>

              <div>
                <span>Payment Method</span>
                <strong>{selectedBooking.payment?.method || "-"}</strong>
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

