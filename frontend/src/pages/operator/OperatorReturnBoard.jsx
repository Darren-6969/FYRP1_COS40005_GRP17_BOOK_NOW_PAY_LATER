import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";

function lateDuration(returnDate) {
  if (!returnDate) {
    return "-";
  }

  const due =
    new Date(returnDate);

  if (
    Number.isNaN(
      due.getTime()
    )
  ) {
    return "-";
  }

  const diff =
    Date.now() -
    due.getTime();

  if (diff <= 0) {
    return "Not late";
  }

  const minutes =
    Math.floor(
      diff / 60000
    );

  const hours =
    Math.floor(
      minutes / 60
    );

  const remainingMinutes =
    minutes % 60;

  return `${hours}h ${remainingMinutes}m late`;
}

function sameLocalDay(
  value,
  target = new Date()
) {
  if (!value) {
    return false;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth() &&
    date.getDate() ===
      target.getDate()
  );
}

export default function OperatorReturnBoard() {
  const [bookings, setBookings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("AWAITING");

  const loadBookings =
    async () => {
      try {
        setLoading(true);
        setError("");

        const res =
          await operatorService.getBookings();

        setBookings(
          res.data.bookings || []
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            "Failed to load return board"
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadBookings();
  }, []);

  const awaitingReturns =
    useMemo(() => {
      return bookings
        .filter(
          (booking) =>
            String(
              booking.status || ""
            ).toUpperCase() ===
            "IN_PROGRESS"
        )
        .sort((a, b) => {
          const aTime =
            new Date(
              a.returnDate || 0
            ).getTime();

          const bTime =
            new Date(
              b.returnDate || 0
            ).getTime();

          return aTime - bTime;
        });
    }, [bookings]);

  const returnedToday =
    useMemo(() => {
      return bookings
        .filter(
          (booking) =>
            String(
              booking.status || ""
            ).toUpperCase() ===
              "COMPLETED" &&
            sameLocalDay(
              booking.returnedAt
            )
        )
        .sort(
          (a, b) =>
            new Date(
              b.returnedAt || 0
            ).getTime() -
            new Date(
              a.returnedAt || 0
            ).getTime()
        );
    }, [bookings]);

  const lateCount =
    awaitingReturns.filter(
      (booking) => {
        if (!booking.returnDate) {
          return false;
        }

        return (
          new Date(
            booking.returnDate
          ).getTime() <
          Date.now()
        );
      }
    ).length;

  const dueTodayCount =
    awaitingReturns.filter(
      (booking) =>
        sameLocalDay(
          booking.returnDate
        )
    ).length;

  const rows =
    activeTab === "AWAITING"
      ? awaitingReturns
      : returnedToday;

  return (
    <div className="operator-page">

      <section className="operator-page-head">
        <div>
          <h1>Return Board</h1>

          <p>
            Track vehicles due for
            return, late returns and
            completed returns.
          </p>
        </div>

        <button
          type="button"
          className="operator-secondary-btn"
          onClick={
            loadBookings
          }
        >
          Refresh
        </button>
      </section>


      {error && (
        <div className="operator-alert danger">
          {error}

          <button
            type="button"
            onClick={
              loadBookings
            }
          >
            Retry
          </button>
        </div>
      )}


      <section className="operator-card">
        <div className="operator-tabs">

          <button
            type="button"
            className={
              activeTab ===
              "AWAITING"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                "AWAITING"
              )
            }
          >
            Awaiting Return
            {" "}
            ({awaitingReturns.length})
          </button>

          <button
            type="button"
            className={
              activeTab ===
              "RETURNED"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                "RETURNED"
              )
            }
          >
            Returned Today
            {" "}
            ({returnedToday.length})
          </button>

        </div>


        {activeTab ===
          "AWAITING" && (
          <div
            style={{
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              padding: "20px",
            }}
          >
            <div>
              <small>
                Vehicles Out
              </small>

              <div>
                <strong>
                  {
                    awaitingReturns.length
                  }
                </strong>
              </div>
            </div>

            <div>
              <small>
                Due Today
              </small>

              <div>
                <strong>
                  {dueTodayCount}
                </strong>
              </div>
            </div>

            <div>
              <small>
                Late Now
              </small>

              <div>
                <strong>
                  {lateCount}
                </strong>
              </div>
            </div>
          </div>
        )}


        {loading ? (
          <div className="operator-empty-state">
            Loading return board...
          </div>
        ) : rows.length === 0 ? (
          <div className="operator-empty-state">
            {activeTab ===
            "AWAITING"
              ? "No vehicles are currently awaiting return."
              : "No vehicles have been returned today."}
          </div>
        ) : (
          <div className="operator-table-wrap">

            <table className="operator-table">

              <thead>
                <tr>
                  <th>
                    Booking
                  </th>

                  <th>
                    Customer
                  </th>

                  <th>
                    Vehicle
                  </th>

                  <th>
                    Scheduled Return
                  </th>

                  <th>
                    Actual Return
                  </th>

                  <th>
                    Return Status
                  </th>

                  <th>
                    Late Charge
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>


              <tbody>
                {rows.map(
                  (booking) => {
                    const isLate =
                      activeTab ===
                        "AWAITING" &&
                      booking.returnDate &&
                      new Date(
                        booking.returnDate
                      ).getTime() <
                        Date.now();

                    return (
                      <tr
                        key={
                          booking.id
                        }
                      >
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
                            {booking
                              .customer
                              ?.name ||
                              "-"}
                          </strong>

                          <small>
                            {booking
                              .customer
                              ?.email ||
                              "-"}
                          </small>
                        </td>

                        <td>
                          {booking.serviceName ||
                            "-"}
                        </td>

                        <td>
                          {formatOperatorDateTime(
                            booking.returnDate
                          )}
                        </td>

                        <td>
                          {booking.returnedAt
                            ? formatOperatorDateTime(
                                booking.returnedAt
                              )
                            : "-"}
                        </td>

                        <td>
                          {activeTab ===
                          "RETURNED" ? (
                            <span className="operator-status success">
                              Returned
                            </span>
                          ) : isLate ? (
                            <span className="operator-status danger">
                              {lateDuration(
                                booking.returnDate
                              )}
                            </span>
                          ) : (
                            <span className="operator-status warning">
                              Awaiting return
                            </span>
                          )}
                        </td>

                        <td>
                          {Number(
                            booking.lateReturnCharge ||
                              0
                          ) > 0
                            ? `RM${Number(
                                booking.lateReturnCharge
                              ).toFixed(
                                2
                              )}`
                            : "-"}
                        </td>

                        <td>
                          <Link
                            className="operator-primary-btn"
                            to={`/operator/bookings/${booking.id}`}
                          >
                            {activeTab ===
                            "AWAITING"
                              ? "Record Return"
                              : "View"}
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>
    </div>
  );
}