import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorBookingLog() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookings();

      setBookings(res.data.bookings || []);
      setCurrentPage(1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load booking log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

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
          <h1>Booking Log / History</h1>
          <p>Complete record of booking status, payment progress, and transaction history.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadBookings}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        {loading ? (
          <div className="operator-empty-state">Loading booking log...</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Pick-up / Check-in</th>
                  <th>Return / Check-out</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                  <th>Booking Status</th>
                  <th>Action</th>
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
                    <td>{booking.customer?.name || "-"}</td>
                    <td>{booking.serviceName}</td>
                    <td>{formatOperatorDateTime(booking.pickupDate)}</td>
                    <td>{formatOperatorDateTime(booking.returnDate)}</td>
                    <td>{formatOperatorMoney(booking.totalAmount)}</td>
                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.payment?.status)}`}>
                        {operatorStatusLabel(booking.payment?.status || "UNPAID")}
                      </span>
                    </td>
                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                        {operatorStatusLabel(booking.status)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/operator/bookings/${booking.id}`}>View</Link>
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
                No booking history found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}