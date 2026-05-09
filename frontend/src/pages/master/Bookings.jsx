import { useEffect, useMemo, useState } from "react";
import {
  acceptBooking,
  getBookings,
  rejectBooking,
} from "../../services/admin_service";

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

function statusClass(status) {
  const value = String(status || "").toUpperCase();

  if (["PAID", "COMPLETED", "ACCEPTED"].includes(value)) return "active";
  if (["PENDING", "PENDING_PAYMENT", "ALTERNATIVE_SUGGESTED"].includes(value)) return "pending";
  if (["OVERDUE", "REJECTED", "CANCELLED", "FAILED"].includes(value)) return "suspended";

  return "pending";
}

function label(value) {
  return String(value || "-").replaceAll("_", " ");
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [operator, setOperator] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getBookings();
      setBookings(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const operators = useMemo(() => {
    const map = new Map();

    bookings.forEach((booking) => {
      if (booking.operator?.id) {
        map.set(booking.operator.id, booking.operator.companyName);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter((booking) => {
      const text = [
        booking.id,
        booking.bookingCode,
        booking.hostBookingRef,
        booking.customer?.name,
        booking.customer?.email,
        booking.operator?.companyName,
        booking.serviceName,
        booking.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesStatus = status === "ALL" || booking.status === status;
      const matchesPayment =
        paymentStatus === "ALL" ||
        String(booking.payment?.status || "UNPAID") === paymentStatus;
      const matchesOperator =
        operator === "ALL" || String(booking.operator?.id) === String(operator);

      return matchesQuery && matchesStatus && matchesPayment && matchesOperator;
    });
  }, [bookings, query, status, paymentStatus, operator]);

  const handleAccept = async (booking) => {
    if (!window.confirm(`Accept booking ${booking.bookingCode || booking.id}?`)) {
      return;
    }

    try {
      await acceptBooking(booking.id);
      setMessage("Booking accepted successfully.");
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to accept booking.");
    }
  };

  const handleReject = async (booking) => {
    if (!window.confirm(`Reject booking ${booking.bookingCode || booking.id}?`)) {
      return;
    }

    try {
      await rejectBooking(booking.id);
      setMessage("Booking rejected successfully.");
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject booking.");
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Booking Management</h3>
            <p>
              Platform-wide booking supervision. Use actions only for admin
              override or emergency handling.
            </p>
          </div>

          <button className="btn" onClick={loadBookings}>Refresh</button>
        </div>

        {message && <div className="alert">{message}</div>}
        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Total" value={bookings.length} />
          <Stat title="Pending" value={bookings.filter((b) => b.status === "PENDING").length} />
          <Stat title="Pending Payment" value={bookings.filter((b) => b.status === "PENDING_PAYMENT").length} />
          <Stat title="Paid" value={bookings.filter((b) => b.status === "PAID" || b.payment?.status === "PAID").length} />
          <Stat title="Overdue" value={bookings.filter((b) => b.status === "OVERDUE").length} danger />
          <Stat title="Rejected/Cancelled" value={bookings.filter((b) => ["REJECTED", "CANCELLED"].includes(b.status)).length} />
        </div>
      </section>

      <section className="card">
        <div className="admin-filter-row">
          <input
            placeholder="Search booking, customer, operator, service..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All Booking Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="ALTERNATIVE_SUGGESTED">Alternative Suggested</option>
            <option value="PENDING_PAYMENT">Pending Payment</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          >
            <option value="ALL">All Payment Status</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="FAILED">Failed</option>
          </select>

          <select value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="ALL">All Operators</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading bookings...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Service</th>
                <th>Pickup</th>
                <th>Deadline</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <strong>{booking.bookingCode || booking.id}</strong>
                    <br />
                    <small>{booking.hostBookingRef || "Direct BNPL"}</small>
                  </td>

                  <td>
                    {booking.customer?.name || "-"}
                    <br />
                    <small>{booking.customer?.email || "-"}</small>
                  </td>

                  <td>{booking.operator?.companyName || "-"}</td>
                  <td>{booking.serviceName}</td>
                  <td>{dateTime(booking.pickupDate)}</td>
                  <td>{dateTime(booking.paymentDeadline)}</td>
                  <td>{money(booking.totalAmount)}</td>

                  <td>
                    <span className={`badge ${statusClass(booking.status)}`}>
                      {label(booking.status)}
                    </span>
                  </td>

                  <td>
                    <span className={`badge ${statusClass(booking.payment?.status || "UNPAID")}`}>
                      {label(booking.payment?.status || "UNPAID")}
                    </span>
                  </td>

                  <td>
                    <div className="actions">
                      <button className="btn" onClick={() => setSelected(booking)}>
                        View
                      </button>

                      {booking.status === "PENDING" && (
                        <>
                          <button className="btn primary" onClick={() => handleAccept(booking)}>
                            Accept
                          </button>
                          <button className="btn danger" onClick={() => handleReject(booking)}>
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan="10">No bookings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-document-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-header">
              <div>
                <h3>{selected.bookingCode || `Booking ${selected.id}`}</h3>
                <p>{selected.serviceName}</p>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="stats-grid">
              <Info title="Customer" value={`${selected.customer?.name || "-"} (${selected.customer?.email || "-"})`} />
              <Info title="Operator" value={selected.operator?.companyName || "-"} />
              <Info title="Booking Status" value={label(selected.status)} />
              <Info title="Payment Status" value={label(selected.payment?.status || "UNPAID")} />
              <Info title="Amount" value={money(selected.totalAmount)} />
              <Info title="Payment Deadline" value={dateTime(selected.paymentDeadline)} />
            </div>

            <table className="table">
              <tbody>
                <tr><td>Booking Date</td><td>{dateTime(selected.createdAt)}</td></tr>
                <tr><td>Pickup / Check-in</td><td>{dateTime(selected.pickupDate)}</td></tr>
                <tr><td>Return / Check-out</td><td>{dateTime(selected.returnDate)}</td></tr>
                <tr><td>Location</td><td>{selected.location || "-"}</td></tr>
                <tr><td>Payment Method</td><td>{selected.payment?.method || "-"}</td></tr>
                <tr><td>Transaction ID</td><td>{selected.payment?.transactionId || "-"}</td></tr>
                <tr><td>Invoice</td><td>{selected.invoice?.invoiceNo || "-"}</td></tr>
                <tr><td>Receipt Uploaded</td><td>{selected.receipt?.imageUrl ? "Yes" : "No"}</td></tr>
              </tbody>
            </table>
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
      <strong>{value || 0}</strong>
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}