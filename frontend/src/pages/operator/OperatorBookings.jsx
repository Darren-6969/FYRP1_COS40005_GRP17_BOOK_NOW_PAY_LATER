import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const tabs = [
  { label: "Pending", value: "PENDING" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Overdue", value: "OVERDUE" },
];

const CONFIRMED_STATUSES = new Set([
  "PAID",
]);

export default function OperatorBookings() {
  const [searchParams] = useSearchParams();
  const statusParam =
    searchParams
      .get("status")
      ?.toUpperCase();

  const [bookings, setBookings] = useState([]);
  const [activeStatus, setActiveStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [
  showHandoverSoon,
  setShowHandoverSoon,
  ] = useState(true);

  const [
    showThisWeek,
    setShowThisWeek,
  ] = useState(true);

  const [
    showLaterUpcoming,
    setShowLaterUpcoming,
  ] = useState(false);
  
  useEffect(() => {
    if (
      statusParam &&
      tabs.some(
        (tab) =>
          tab.value === statusParam
      )
    ) {
      setActiveStatus(statusParam);
      setCurrentPage(1);

      if (statusParam !== "UPCOMING") {
        setShowLaterUpcoming(false);
      }
    }
  }, [statusParam]);

  const rowsPerPage = 10;

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookings({
  q: search || undefined,
});

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

  const handleBookingAction = async (
  bookingId,
  action
    ) => {
      try {
        setActionLoading(
          `${action}-${bookingId}`
        );

        if (action === "accept") {
          await operatorService.acceptBooking(
            bookingId
          );
        }

        if (action === "reject") {
          await operatorService.rejectBooking(
            bookingId
          );
        }

        await loadBookings();
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Booking action failed"
        );
      } finally {
        setActionLoading("");
      }
    };

  const filteredBookings = useMemo(() => {
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return bookings
    .filter((booking) => {
      const status = String(
        booking.status || ""
      ).toUpperCase();

      const pickupDate = booking.pickupDate
        ? new Date(booking.pickupDate)
        : null;

      // =========================
      // PENDING
      // =========================
      if (activeStatus === "PENDING") {
        return status === "PENDING";
      }

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

      const paymentStatus = String(
        booking.payment?.status || ""
      ).toUpperCase();

      if (paymentStatus !== "PAID") {
        return false;
      }

      // =========================
      // IN PROGRESS
      // =========================
      if (activeStatus === "IN_PROGRESS") {
        return status === "IN_PROGRESS";
      }

      // =========================
      // UPCOMING
      // =========================
      if (activeStatus === "UPCOMING") {
        const upcomingStatuses = [
          "PAID",
          "READY_FOR_PICKUP",
        ];

        if (!upcomingStatuses.includes(status)) {
          return false;
        }

        if (
          !pickupDate ||
          Number.isNaN(pickupDate.getTime())
        ) {
          return false;
        }

        const pickupDay = new Date(
          pickupDate.getFullYear(),
          pickupDate.getMonth(),
          pickupDate.getDate()
        );

        return pickupDay >= today;
      }

      return false;
    })
    .sort((a, b) => {
      if (activeStatus !== "UPCOMING") {
        return 0;
      }

      const dateA =
        new Date(a.pickupDate).getTime();

      const dateB =
        new Date(b.pickupDate).getTime();

      return dateA - dateB;
    });
    }, [bookings, activeStatus]);


    const upcomingGroups = useMemo(() => {
      const groups = {
        handoverSoon: [],
        thisWeek: [],
        later: [],
      };

      if (activeStatus !== "UPCOMING") {
        return groups;
      }

      const now = new Date();

      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      filteredBookings.forEach((booking) => {
        if (!booking.pickupDate) {
          return;
        }

        const pickupDate =
          new Date(booking.pickupDate);

        if (
          Number.isNaN(
            pickupDate.getTime()
          )
        ) {
          return;
        }

        const pickupDay = new Date(
          pickupDate.getFullYear(),
          pickupDate.getMonth(),
          pickupDate.getDate()
        );

        const differenceInMs =
          pickupDay.getTime() -
          today.getTime();

        const daysUntilPickup =
          Math.floor(
            differenceInMs /
              (1000 * 60 * 60 * 24)
          );

        // Today - 2 days
        if (
          daysUntilPickup >= 0 &&
          daysUntilPickup <= 2
        ) {
          groups.handoverSoon.push(
            booking
          );
          return;
        }

        // 3 - 7 days
        if (
          daysUntilPickup >= 3 &&
          daysUntilPickup <= 7
        ) {
          groups.thisWeek.push(
            booking
          );
          return;
        }

        // More than 7 days
        if (daysUntilPickup > 7) {
          groups.later.push(
            booking
          );
        }
      });

      return groups;
    }, [
      filteredBookings,
      activeStatus,
    ]);

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

  const getHandoverLabel = (booking) => {
  if (!booking.pickupDate) {
    return "-";
  }

  const pickupDate =
    new Date(booking.pickupDate);

  if (
    Number.isNaN(
      pickupDate.getTime()
    )
  ) {
    return "-";
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const pickupDay = new Date(
    pickupDate.getFullYear(),
    pickupDate.getMonth(),
    pickupDate.getDate()
  );

  const differenceInMs =
    pickupDay.getTime() -
    today.getTime();

  const daysUntilPickup =
    Math.round(
      differenceInMs /
        (1000 * 60 * 60 * 24)
    );

  if (daysUntilPickup === 0) {
    return "Today";
  }

  if (daysUntilPickup === 1) {
    return "Tomorrow";
  }

  if (daysUntilPickup === 2) {
    return "In 2 Days";
  }

  return formatOperatorDateTime(
    booking.pickupDate
  );
};


const renderUpcomingTable = (
  bookingList
) => {
  if (!bookingList.length) {
    return (
      <div className="operator-empty-state">
        No bookings in this section.
      </div>
    );
  }

  return (
    <div className="operator-table-wrap operator-booking-table-wrap">
      <table className="operator-table operator-booking-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Handover</th>
            <th>Return</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {bookingList.map(
            (booking) => (
              <tr key={booking.id}>
                <td>
                  <Link
                    to={`/operator/bookings/${booking.id}`}
                  >
                    {booking.bookingCode ||
                      `BNPL-${String(
                        booking.id
                      ).padStart(
                        4,
                        "0"
                      )}`}
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
                  <div className="operator-handover-cell">
                    <strong>
                      {getHandoverLabel(
                        booking
                      )}
                    </strong>

                    <small>
                      {formatOperatorDateTime(
                        booking.pickupDate
                      )}
                    </small>
                  </div>
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
                  <span className="operator-status success">
                    ✓ Fully Paid
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
  );
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
            Review pending booking requests and manage
            bookings throughout their rental lifecycle.
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
  {activeStatus === "UPCOMING" ? (
    <div className="operator-upcoming-dashboard">

      <div className="operator-upcoming-summary">

        <div className="operator-upcoming-stat">
          <span>Total Upcoming</span>
          <strong>
            {filteredBookings.length}
          </strong>
        </div>

        <div className="operator-upcoming-stat">
          <span>Handover Soon</span>
          <strong>
            {upcomingGroups.handoverSoon.length}
          </strong>
          <small>
            Within 2 days
          </small>
        </div>

        <div className="operator-upcoming-stat">
          <span>This Week</span>
          <strong>
            {upcomingGroups.thisWeek.length}
          </strong>
          <small>
            Within 3–7 days
          </small>
        </div>

        <div className="operator-upcoming-stat">
          <span>Later</span>
          <strong>
            {upcomingGroups.later.length}
          </strong>
          <small>
            More than 7 days
          </small>
        </div>

      </div>


      <section className="operator-upcoming-section urgent">

      <button
        type="button"
        className="operator-upcoming-section-toggle"
        onClick={() =>
          setShowHandoverSoon(
            (current) => !current
          )
        }
      >
        <div className="operator-upcoming-section-title">
          <div className="operator-upcoming-section-icon">
            !
          </div>

          <div>
            <h3>Handover Soon</h3>

            <p>
              Fully paid bookings requiring
              handover within the next 2 days.
            </p>
          </div>
        </div>

        <div className="operator-upcoming-section-actions">
          <span className="operator-upcoming-count">
            {
              upcomingGroups
                .handoverSoon
                .length
            }
          </span>

          <span className="operator-upcoming-chevron">
            {showHandoverSoon
              ? "▲"
              : "▼"}
          </span>
        </div>
      </button>

      {showHandoverSoon &&
        renderUpcomingTable(
          upcomingGroups.handoverSoon
        )}

    </section>


      <section className="operator-upcoming-section">

      <button
        type="button"
        className="operator-upcoming-section-toggle"
        onClick={() =>
          setShowThisWeek(
            (current) => !current
          )
        }
      >
        <div className="operator-upcoming-section-title">
          <div className="operator-upcoming-section-icon">
            7
          </div>

          <div>
            <h3>This Week</h3>

            <p>
              Upcoming handovers within
              the next 3–7 days.
            </p>
          </div>
        </div>

        <div className="operator-upcoming-section-actions">
          <span className="operator-upcoming-count">
            {
              upcomingGroups
                .thisWeek
                .length
            }
          </span>

          <span className="operator-upcoming-chevron">
            {showThisWeek
              ? "▲"
              : "▼"}
          </span>
        </div>
      </button>

      {showThisWeek &&
        renderUpcomingTable(
          upcomingGroups.thisWeek
        )}

    </section>


      <section className="operator-upcoming-section">

      <button
        type="button"
        className="operator-upcoming-section-toggle"
        onClick={() =>
          setShowLaterUpcoming(
            (current) => !current
          )
        }
      >
        <div className="operator-upcoming-section-title">
          <div className="operator-upcoming-section-icon">
            +
          </div>

          <div>
            <h3>Later Upcoming</h3>

            <p>
              Fully paid bookings more
              than 7 days away.
            </p>
          </div>
        </div>

        <div className="operator-upcoming-section-actions">
          <span className="operator-upcoming-count">
            {
              upcomingGroups
                .later
                .length
            }
          </span>

          <span className="operator-upcoming-chevron">
            {showLaterUpcoming
              ? "▲"
              : "▼"}
          </span>
        </div>
      </button>

      {showLaterUpcoming &&
        renderUpcomingTable(
          upcomingGroups.later
        )}

    </section>

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

                            {String(
                              booking.status || ""
                            ).toUpperCase() === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="success"
                                  disabled={!!actionLoading}
                                  onClick={() =>
                                    handleBookingAction(
                                      booking.id,
                                      "accept"
                                    )
                                  }
                                  title="Accept Booking"
                                >
                                  {actionLoading ===
                                  `accept-${booking.id}`
                                    ? "..."
                                    : "✓"}
                                </button>

                                <button
                                  type="button"
                                  className="danger"
                                  disabled={!!actionLoading}
                                  onClick={() =>
                                    handleBookingAction(
                                      booking.id,
                                      "reject"
                                    )
                                  }
                                  title="Reject Booking"
                                >
                                  {actionLoading ===
                                  `reject-${booking.id}`
                                    ? "..."
                                    : "✕"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            </>
            )}

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