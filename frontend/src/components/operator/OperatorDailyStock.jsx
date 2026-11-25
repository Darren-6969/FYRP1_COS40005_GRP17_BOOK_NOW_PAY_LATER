
import { useEffect, useState } from "react";
import { operatorService } from "../../services/operator_service";

function malaysiaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function errorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong."
  );
}

export default function OperatorDailyStock({
  listing,
  onClose,
  onUpdated,
  // BNPLB-184: opened from a sold-out alert on its dates.
  initialFrom,
  initialTo,
}) {
  const [fromDate, setFromDate] = useState(() => initialFrom || malaysiaToday());
  const [toDate, setToDate] = useState(() => initialTo || initialFrom || malaysiaToday());
  const [quantity, setQuantity] = useState(
    String(listing.quantity)
  );

  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const defaultQuantity = Number(listing.quantity);

  const loadAllocations = async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await operatorService.getListingAllocations(
          listing.id,
          { from: fromDate, to: toDate }
        );

      setAllocations(response.data?.allocations || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [listing.id, fromDate, toDate]);

  const save = async (reset = false) => {
    setError("");
    setMessage("");

    const parsedQuantity = Number(quantity);

    if (!fromDate || !toDate || toDate < fromDate) {
      setError("Please select a valid date range.");
      return;
    }

    if (
      !reset &&
      (
        quantity.trim() === "" ||
        !Number.isSafeInteger(parsedQuantity) ||
        parsedQuantity < 0 ||
        parsedQuantity > defaultQuantity
      )
    ) {
      setError(
        `Quantity must be between 0 and ${defaultQuantity}.`
      );
      return;
    }

    const action = reset
      ? "Restore default stock for the selected dates?"
      : `Set daily fleet capacity to ${parsedQuantity}?`;

    if (!window.confirm(action)) return;

    setSaving(true);

    try {
      await operatorService.updateDailyStockAllocation(
        listing.id,
        {
          fromDate,
          toDate,
          quantity: reset ? null : parsedQuantity,
        }
      );

      setMessage(
        reset
          ? "Default stock restored successfully."
          : "Daily stock updated successfully."
      );

      await loadAllocations();
      await onUpdated?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily Stock Management"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--card-bg, #fff)",
          color: "var(--text-primary, #17232c)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 16px 50px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Daily Stock Management
            </h2>
            <p style={{ marginTop: 6 }}>
              {listing.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="operator-secondary-btn"
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: "rgba(7,134,155,0.08)",
            marginBottom: 18,
          }}
        >
          Default Fleet Quantity:{" "}
          <strong>{defaultQuantity} cars</strong>
          <p style={{ fontSize: 13, marginBottom: 0 }}>
            Daily adjustments only affect the selected
            dates. Existing reservations remain protected.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <label>
            Start Date
            <input
              type="date"
              value={fromDate}
              min={malaysiaToday()}
              onChange={(event) =>
                setFromDate(event.target.value)
              }
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) =>
                setToDate(event.target.value)
              }
              style={{ width: "100%", padding: 10 }}
            />
          </label>
        </div>

        <label
          style={{
            display: "block",
            marginTop: 16,
          }}
        >
          Daily Fleet Quantity
          <input
            type="number"
            min="0"
            max={defaultQuantity}
            step="1"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value)
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
            }}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: "#c62828" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#07869b" }}>
            {message}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="operator-primary-btn"
            disabled={saving}
            onClick={() => save(false)}
          >
            {saving ? "Saving..." : "Save Allocation"}
          </button>

          <button
            type="button"
            className="operator-secondary-btn"
            disabled={saving}
            onClick={() => save(true)}
          >
            Restore Default
          </button>
        </div>

        <h3 style={{ marginTop: 24 }}>
          Existing Daily Allocations
        </h3>

        {loading ? (
          <p>Loading allocations...</p>
        ) : allocations.length === 0 ? (
          <p>
            No daily overrides or servicing blocks
            for this date range.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Capacity</th>
                  <th>Servicing</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((item) => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td>
                      {item.quantity ??
                        defaultQuantity}
                    </td>
                    <td>
                      {item.blockedQuantity || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 12, opacity: 0.7 }}>
          This table shows stored daily allocations,
          not the live number of cars remaining after
          customer bookings.
        </p>
      </section>
    </div>
  );
}
