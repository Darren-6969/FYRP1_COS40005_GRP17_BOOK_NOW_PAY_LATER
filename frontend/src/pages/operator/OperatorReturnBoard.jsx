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

  const [listings, setListings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("AWAITING");


  // =========================
  // Servicing states
  // =========================

  const [
    selectedListingId,
    setSelectedListingId,
  ] = useState("");

  const [
    servicingFrom,
    setServicingFrom,
  ] = useState("");

  const [
    servicingTo,
    setServicingTo,
  ] = useState("");

  const [
    servicingNote,
    setServicingNote,
  ] = useState(
    "Scheduled servicing"
  );

  const [
    servicingQuantity,
    setServicingQuantity,
    ] = useState(1);

  const [
    allocations,
    setAllocations,
  ] = useState([]);

  const [
    servicingLoading,
    setServicingLoading,
  ] = useState(false);

  const [
    servicingAction,
    setServicingAction,
  ] = useState(false);


  // =========================
  // Load bookings
  // =========================

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


  // =========================
  // Load vehicle listings
  // =========================

  const loadListings =
    async () => {
      try {
        const res =
          await operatorService.getListings();

        const allListings =
          res.data?.listings || [];

        const carListings =
          allListings.filter(
            (listing) =>
              String(
                listing.category || ""
              ).toUpperCase() ===
              "CAR_RENTAL"
          );

        setListings(
          carListings
        );

        if (
          !selectedListingId &&
          carListings.length
        ) {
          setSelectedListingId(
            String(
              carListings[0].id
            )
          );
        }
      } catch (err) {
        console.error(
          "Failed to load listings:",
          err
        );
      }
    };


  // =========================
  // Load servicing blocks
  // =========================

  const loadAllocations =
    async (
      listingId =
        selectedListingId
    ) => {
      if (!listingId) {
        setAllocations([]);
        return;
      }

      try {
        setServicingLoading(true);

        const res =
          await operatorService
            .getListingAllocations(
              listingId
            );

        setAllocations(
          res.data?.allocations ||
            []
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            "Failed to load servicing dates"
        );
      } finally {
        setServicingLoading(
          false
        );
      }
    };


  useEffect(() => {
    loadBookings();
    loadListings();
  }, []);


  useEffect(() => {
    if (
      activeTab ===
        "SERVICING" &&
      selectedListingId
    ) {
      loadAllocations(
        selectedListingId
      );
    }
  }, [
    activeTab,
    selectedListingId,
  ]);


  // =========================
  // Booking calculations
  // =========================

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

    const selectedListing =
  useMemo(() => {
    return listings.find(
      (listing) =>
        String(listing.id) ===
        String(selectedListingId)
    );
  }, [
    listings,
    selectedListingId,
  ]);

const totalFleetQuantity =
  Number(
    selectedListing?.quantity || 0
  );

  const blockedAllocations =
    allocations.filter(
      (item) =>
        item.isBlocked === true
    );


  // =========================
  // Block servicing dates
  // =========================

  const handleBlockDates =
    async () => {
      if (!selectedListingId) {
        alert(
          "Please select a vehicle."
        );
        return;
      }

      if (
        !servicingFrom ||
        !servicingTo
      ) {
        alert(
          "Please select the servicing start and end dates."
        );
        return;
      }

      const quantity =
        Number(
            servicingQuantity
        );

        if (
        !Number.isInteger(quantity) ||
        quantity < 1
        ) {
        alert(
            "Servicing quantity must be at least 1."
        );
        return;
        }

        if (
        totalFleetQuantity > 0 &&
        quantity >
            totalFleetQuantity
        ) {
        alert(
            `This listing only has ${totalFleetQuantity} vehicle(s).`
        );
        return;
        }

      if (
        servicingTo <
        servicingFrom
      ) {
        alert(
          "End date cannot be earlier than the start date."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Block ${servicingFrom} to ${servicingTo} for servicing?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setServicingAction(true);
            await operatorService
            .blockListingForServicing(
                selectedListingId,
                {
                fromDate:
                    servicingFrom,

                toDate:
                    servicingTo,

                blockedQuantity:
                    Number(
                    servicingQuantity
                    ),

                note:
                    servicingNote ||
                    "Scheduled servicing",
                }
            );

        alert(
          "Servicing dates blocked successfully."
        );

        setServicingFrom("");
        setServicingTo("");
        setServicingNote(
          "Scheduled servicing"
        );

        setServicingQuantity(1);

        await loadAllocations(
          selectedListingId
        );
      } catch (err) {
        alert(
          err.response?.data
            ?.message ||
            "Failed to block servicing dates"
        );
      } finally {
        setServicingAction(
          false
        );
      }
    };


  // =========================
  // Remove one blocked date
  // =========================

  const handleRemoveBlock =
    async (date) => {
      const confirmed =
        window.confirm(
          `Remove servicing block for ${date}?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setServicingAction(true);

        await operatorService
          .unblockListingServicing(
            selectedListingId,
            {
              fromDate: date,
              toDate: date,
            }
          );

        await loadAllocations(
          selectedListingId
        );
      } catch (err) {
        alert(
          err.response?.data
            ?.message ||
            "Failed to remove servicing block"
        );
      } finally {
        setServicingAction(
          false
        );
      }
    };


  const handleRefresh =
    async () => {
      if (
        activeTab ===
        "SERVICING"
      ) {
        await loadListings();

        await loadAllocations(
          selectedListingId
        );

        return;
      }

      await loadBookings();
    };


  return (
    <div className="operator-page">

      <section className="operator-page-head">
        <div>
          <h1>
            Return Board
          </h1>

          <p>
            Track vehicle returns,
            late charges and servicing
            blocked dates.
          </p>
        </div>

        <button
          type="button"
          className="operator-secondary-btn"
          onClick={
            handleRefresh
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
            onClick={() => {
              setError("");
              handleRefresh();
            }}
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
            Awaiting Return{" "}
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
            Returned Today{" "}
            ({returnedToday.length})
          </button>


          <button
            type="button"
            className={
              activeTab ===
              "SERVICING"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                "SERVICING"
              )
            }
          >
            Servicing
          </button>

        </div>


        {/* ========================= */}
        {/* AWAITING SUMMARY */}
        {/* ========================= */}

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


        {/* ========================= */}
        {/* SERVICING */}
        {/* ========================= */}

        {activeTab ===
          "SERVICING" && (
          <div
            style={{
              padding: "24px",
            }}
          >

            <div
              style={{
                marginBottom:
                  "24px",
              }}
            >
              <h2>
                Servicing & Blocked
                Dates
              </h2>

              <p>
                Block a vehicle from
                customer bookings while
                it is being serviced.
              </p>
            </div>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                marginBottom:
                  "20px",
              }}
            >

              <label className="operator-field">
                Vehicle

                <select
                  value={
                    selectedListingId
                  }
                  onChange={(e) => {
                    setSelectedListingId(
                        e.target.value
                    );

                    setServicingQuantity(1);
                    }}
                >
                  <option value="">
                    Select vehicle
                  </option>

                  {listings.map(
                    (listing) => (
                      <option
                        key={
                          listing.id
                        }
                        value={
                          listing.id
                        }
                      >
                        {listing.name ||
                          `${listing.vehicleMake || ""} ${listing.vehicleModel || ""}`.trim() ||
                          `Listing ${listing.id}`}
                      </option>
                    )
                  )}

                </select>
              </label>

              <label className="operator-field">
            Quantity for Servicing

            <input
                type="number"
                min="1"
                max={
                totalFleetQuantity ||
                undefined
                }
                value={
                servicingQuantity
                }
                onChange={(e) =>
                setServicingQuantity(
                    e.target.value
                )
                }
            />

            {selectedListing && (
                <small>
                Total fleet:{" "}
                {totalFleetQuantity}{" "}
                vehicle
                {totalFleetQuantity === 1
                    ? ""
                    : "s"}
                {" · "}
                Available after servicing:{" "}
                {Math.max(
                    0,
                    totalFleetQuantity -
                    Number(
                        servicingQuantity ||
                        0
                    )
                )}
                </small>
            )}
            </label>    

              <label className="operator-field">
                Start Date

                <input
                  type="date"
                  value={
                    servicingFrom
                  }
                  onChange={(e) =>
                    setServicingFrom(
                      e.target.value
                    )
                  }
                />
              </label>


              <label className="operator-field">
                End Date

                <input
                  type="date"
                  value={
                    servicingTo
                  }
                  onChange={(e) =>
                    setServicingTo(
                      e.target.value
                    )
                  }
                />
              </label>

            </div>


            <label className="operator-field">
              Reason

              <input
                type="text"
                placeholder="e.g. Scheduled servicing"
                value={
                  servicingNote
                }
                onChange={(e) =>
                  setServicingNote(
                    e.target.value
                  )
                }
              />
            </label>


            <div
              style={{
                marginTop: "20px",
                marginBottom:
                  "32px",
              }}
            >
              <button
                type="button"
                className="operator-primary-btn"
                disabled={
                  servicingAction
                }
                onClick={
                  handleBlockDates
                }
              >
                {servicingAction
                  ? "Processing..."
                  : "Block Dates"}
              </button>
            </div>


            <hr />


            <div
              style={{
                marginTop: "24px",
              }}
            >
              <h3>
                Current Blocked Dates
              </h3>

              {!selectedListingId ? (
                <div className="operator-empty-state">
                  Select a vehicle to
                  view blocked dates.
                </div>
              ) : servicingLoading ? (
                <div className="operator-empty-state">
                  Loading servicing
                  dates...
                </div>
              ) : blockedAllocations.length ===
                0 ? (
                <div className="operator-empty-state">
                  No servicing dates
                  are currently blocked
                  for this vehicle.
                </div>
              ) : (
                <div className="operator-table-wrap">

                  <table className="operator-table">

                    <thead>
                      <tr>
                        <th>
                          Date
                        </th>

                        <th>
                          Reason
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {blockedAllocations.map(
                        (
                          allocation
                        ) => (
                          <tr
                            key={
                              allocation.id
                            }
                          >
                            <td>
                              {
                                allocation.date
                              }
                            </td>

                            <td>
                              {allocation.note ||
                                "Vehicle servicing"}
                            </td>

                            <td>
                              <span className="operator-status danger">
                                Blocked
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="operator-secondary-btn"
                                disabled={
                                  servicingAction
                                }
                                onClick={() =>
                                  handleRemoveBlock(
                                    allocation.date
                                  )
                                }
                              >
                                Remove Block
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                  </table>

                </div>
              )}
            </div>

          </div>
        )}


        {/* ========================= */}
        {/* RETURN TABLE */}
        {/* ========================= */}

        {activeTab !==
          "SERVICING" && (
          <>
            {loading ? (
              <div className="operator-empty-state">
                Loading return board...
              </div>
            ) : rows.length ===
              0 ? (
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
          </>
        )}

      </section>
    </div>
  );
}