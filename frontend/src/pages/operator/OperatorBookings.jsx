import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const tabs = [
  { label: "Upcoming", value: "UPCOMING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Overdue", value: "OVERDUE" },
];

const CONFIRMED_STATUSES = new Set([
  "ACCEPTED",
  "PENDING_PAYMENT",
  "PAID",
]);

export default function OperatorBookings() {
  const [bookings, setBookings] = useState([]);
  const [activeStatus, setActiveStatus] = useState("UPCOMING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookings({
  q: search || undefined,
});

console.log("BOOKINGS FROM BACKEND:", res.data.bookings);

setBookings(res.data.bookings || []);
      setCurrentPage(1);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load bookings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
  const now = new Date();

  // Today's date at 00:00
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return bookings.filter((booking) => {
    const status = String(
      booking.status || ""
    ).toUpperCase();

    const pickupDate = booking.pickupDate
      ? new Date(booking.pickupDate)
      : null;

    const returnDate = booking.returnDate
      ? new Date(booking.returnDate)
      : null;

    // =========================
    // COMPLETED
    // =========================
    if (activeStatus === "COMPLETED") {
      return status === "COMPLETED";
    }

    // =========================
    // CANCELLED
    // =========================
    if (activeStatus === "CANCELLED") {
      return status === "CANCELLED";
    }

    // =========================
    // OVERDUE
    // =========================
    if (activeStatus === "OVERDUE") {
      return status === "OVERDUE";
    }

    // Only confirmed / active bookings
    const activeStatuses = [
      "ACCEPTED",
      "PENDING_PAYMENT",
      "PAID",
    ];

    if (!activeStatuses.includes(status)) {
      return false;
    }

    // Invalid pickup date
    if (
      !pickupDate ||
      Number.isNaN(pickupDate.getTime())
    ) {
      return false;
    }

    // =========================
    // UPCOMING
    // =========================
    if (activeStatus === "UPCOMING") {
      const pickupDay = new Date(
        pickupDate.getFullYear(),
        pickupDate.getMonth(),
        pickupDate.getDate()
      );

      /*
       * Show bookings whose pickup date
       * is today or in the future.
       */
      return pickupDay >= today;
    }

    // =========================
    // IN PROGRESS
    // =========================
    if (activeStatus === "IN_PROGRESS") {
      const hasStarted = pickupDate <= now;

      const hasNotEnded =
        !returnDate ||
        Number.isNaN(returnDate.getTime()) ||
        returnDate >= now;

      return hasStarted && hasNotEnded;
    }

    return false;
  });
}, [bookings, activeStatus]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / rowsPerPage)
  );

  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleTabChange = (status) => {
    setActiveStatus(status);
    setCurrentPage(1);
  };

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(
      totalPages - 1,
      currentPage + 1
    );

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Bookings</h1>

          <p>
            View confirmed bookings throughout their
            rental lifecycle.
          </p>
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
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <button type="submit">
            Search
          </button>
        </form>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}

          <button
            type="button"
            onClick={loadBookings}
          >
            Retry
          </button>
        </div>
      )}

      <section className="operator-card">
        <div className="operator-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={
                activeStatus === tab.value
                  ? "active"
                  : ""
              }
              onClick={() =>
                handleTabChange(tab.value)
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="operator-empty-state">
            Loading bookings...
          </div>
        ) : (
          <>
            <div className="operator-table-wrap operator-booking-table-wrap">
              <table className="operator-table operator-booking-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Pickup / Check-in</th>
                    <th>Return / Check-out</th>
                    <th>Amount</th>
                    <th>Booking Status</th>
                    <th>Payment Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedBookings.map(
                    (booking) => (
                      <tr key={booking.id}>
                        <td>
                          <Link
                            to={`/operator/bookings/${booking.id}`}
                          >
                            {booking.bookingCode ||
                              `BNPL-${String(
                                booking.id
                              ).padStart(4, "0")}`}
                          </Link>
                        </td>

                        <td>
                          <strong>
                            {booking.customer?.name ||
                              "-"}
                          </strong>

                          <small>
                            {booking.customer?.email ||
                              "-"}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {booking.serviceName ||
                              "-"}
                          </strong>

                          <small>
                            {booking.serviceType ||
                              "-"}
                          </small>
                        </td>

                        <td>
                          {formatOperatorDateTime(
                            booking.pickupDate
                          )}
                        </td>

                        <td>
                          {formatOperatorDateTime(
                            booking.returnDate
                          )}
                        </td>

                        <td>
                          {formatOperatorMoney(
                            booking.totalAmount
                          )}
                        </td>

                        <td>
                          <span
                            className={`operator-status ${operatorStatusClass(
                              booking.status
                            )}`}
                          >
                            {operatorStatusLabel(
                              booking.status
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`operator-status ${operatorStatusClass(
                              booking.payment?.status
                            )}`}
                          >
                            {operatorStatusLabel(
                              booking.payment?.status ||
                                "UNPAID"
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="operator-table-actions">
                            <Link
                              to={`/operator/bookings/${booking.id}`}
                              title="View Booking"
                            >
                              👁
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {filteredBookings.length > 0 && (
              <div className="operator-pagination">
                <span>
                  Showing{" "}
                  {(currentPage - 1) *
                    rowsPerPage +
                    1}
                  -
                  {Math.min(
                    currentPage * rowsPerPage,
                    filteredBookings.length
                  )}{" "}
                  of {filteredBookings.length}
                </span>

                <div className="operator-pagination-actions">
                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage - 1
                      )
                    }
                    disabled={
                      currentPage === 1
                    }
                  >
                    Prev
                  </button>

                  {getPageNumbers().map(
                    (page, index) => {
                      if (page === "...") {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="pagination-ellipsis"
                          >
                            ...
                          </span>
                        );
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          className={
                            currentPage === page
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            goToPage(page)
                          }
                        >
                          {page}
                        </button>
                      );
                    }
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage + 1
                      )
                    }
                    disabled={
                      currentPage === totalPages
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {!filteredBookings.length && (
              <div className="operator-empty-state">
                No{" "}
                {activeStatus
                  .replaceAll("_", " ")
                  .toLowerCase()}{" "}
                bookings found.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}