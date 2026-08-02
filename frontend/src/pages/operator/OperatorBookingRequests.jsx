import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const tabs = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Payment Required", value: "PENDING_PAYMENT" },
  { label: "Paid", value: "PAID" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Overdue", value: "OVERDUE" },
];

const POLL_INTERVAL_MS = 8000;

export default function OperatorBookingRequests() {
  const [bookings, setBookings] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const loadBookings = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const res = await operatorService.getBookings({
        status: activeStatus,
        q: search || undefined,
      });

      setBookings(res.data.bookings || []);

      // Only jump back to page 1 on a user-triggered load, never on a poll.
      if (!silent) setCurrentPage(1);
    } catch (err) {
      // Stay quiet on poll failures so a transient blip does not flash an error.
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load bookings");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Let the interval always call the newest closure (current tab + search text).
  const loadBookingsRef = useRef(loadBookings);
  useEffect(() => {
    loadBookingsRef.current = loadBookings;
  });

  useEffect(() => {
    loadBookings();
  }, [activeStatus]);

  // Bug #1: keeps the booking list near-real-time without WebSockets.
  // Mirrors the notification-bell polling in useNotifications.js.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      loadBookingsRef.current({ silent: true });
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const handleAction = async (bookingId, action) => {
    try {
      setActionLoading(`${action}-${bookingId}`);

      if (action === "accept") await operatorService.acceptBooking(bookingId);
      if (action === "reject") await operatorService.rejectBooking(bookingId);

      await loadBookings();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  const canAcceptReject = (booking) => {
  return String(booking.status || "").toUpperCase() === "PENDING";
};

  const canSendPayment = (booking) => {
    const status = String(booking.status || "").toUpperCase();
    const paymentStatus = String(booking.payment?.status || "").toUpperCase();

    return (
      ["ACCEPTED", "PENDING_PAYMENT"].includes(status) &&
      paymentStatus !== "PAID"
    );
  };

  const totalPages = Math.max(1, Math.ceil(bookings.length / rowsPerPage));

  const paginatedBookings = bookings.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }

  function getPageNumbers() {
  const pages = [];

  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);

  return pages;
  } 

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Booking Requests</h1>
          <p>Review and manage incoming booking requests from host booking forms.</p>
        </div>

        <form
          className="operator-search-inline"
          onSubmit={(e) => {
            e.preventDefault();
            loadBookings();
          }}
        >
          <input
            placeholder="Search booking ID, customer, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={() => loadBookings()}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        <div className="operator-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={activeStatus === tab.value ? "active" : ""}
              onClick={() => setActiveStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading bookings...</div>
        ) : (
          <div className="operator-table-wrap operator-booking-table-wrap">
           <table className="operator-table operator-booking-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Booking Date</th>
                  <th>Pickup / Check-in</th>
                  <th>Amount</th>
                  <th>Booking Status</th>
                  <th>Payment Status</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <Link to={`/operator/bookings/${booking.id}`}>
                        {booking.bookingCode || `BNPL-${String(booking.id).padStart(4, "0")}`}
                      </Link>
                    </td>

                    <td>
                      <strong>{booking.customer?.name || "-"}</strong>
                      <small>{booking.customer?.email || "-"}</small>
                    </td>

                    <td>
                      <strong>{booking.serviceName}</strong>
                      <small>{booking.serviceType || "-"}</small>
                    </td>

                    <td>{formatOperatorDateTime(booking.createdAt)}</td>
                    <td>{formatOperatorDateTime(booking.pickupDate)}</td>
                    <td>{formatOperatorMoney(booking.totalAmount)}</td>

                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                        {operatorStatusLabel(booking.status)}
                      </span>
                    </td>

                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.payment?.status)}`}>
                        {operatorStatusLabel(booking.payment?.status || "UNPAID")}
                      </span>
                    </td>

                    <td>{formatOperatorDateTime(booking.paymentDeadline)}</td>

                    <td>
                      <div className="operator-table-actions">
                        <Link to={`/operator/bookings/${booking.id}`} title="View Booking">
                          👁
                        </Link>

                        {String(booking.status || "").toUpperCase() === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="success"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(booking.id, "accept")}
                              title="Accept Booking"
                            >
                              ✓
                            </button>

                            <button
                              type="button"
                              className="danger"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(booking.id, "reject")}
                              title="Reject Booking"
                            >
                              ✗
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {bookings.length > 0 && (
              <div className="operator-pagination">
                <span>
                  Showing {(currentPage - 1) * rowsPerPage + 1}-
                  {Math.min(currentPage * rowsPerPage, bookings.length)} of{" "}
                  {bookings.length}
                </span>

                <div className="operator-pagination-actions">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>

                  {getPageNumbers().map((page, index) => {
                    if (page === "...") {
                      return (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                          ...
                        </span>
                      );
                    }

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
            )}

            {!bookings.length && (
              <div className="operator-empty-state">
                No bookings found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}