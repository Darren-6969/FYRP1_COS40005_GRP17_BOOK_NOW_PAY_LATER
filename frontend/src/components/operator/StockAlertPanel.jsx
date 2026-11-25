import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { operatorService } from "../../services/operator_service";
import OperatorBranchTransfer from "./OperatorBranchTransfer";
import OperatorDailyStock from "./OperatorDailyStock";

// BNPLB-184: the sold-out alert, opened from the notification. It names the
// listing and dates and offers the two ways to take the next request: raise
// the car count (fleet total) or move a car from another branch. Daily Stock
// for the dates is there too, for when a date was lowered on purpose.

function plainDateText(value) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

// Same vehicle identity Branch Transfer uses, so only cars it accepts are offered.
function vehicleIdentity(listing) {
  return [listing.vehicleMake, listing.vehicleModel, listing.vehicleType, listing.modelYear, listing.transmission, listing.seats]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

export default function StockAlertPanel({ listing, dates, listings, onUpdated, onDismiss }) {
  const [count, setCount] = useState(String(Number(listing.quantity || 0) + 1));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [transferFrom, setTransferFrom] = useState(null);
  const [showDailyStock, setShowDailyStock] = useState(false);

  const isCar = String(listing.category || "").toUpperCase() === "CAR_RENTAL";
  const sorted = [...dates].sort();
  const datesText =
    sorted.length > 3
      ? `${plainDateText(sorted[0])} to ${plainDateText(sorted[sorted.length - 1])}`
      : sorted.map(plainDateText).join(", ");

  const sources = isCar
    ? listings.filter(
        (item) =>
          item.id !== listing.id &&
          item.branchId !== listing.branchId &&
          String(item.category || "").toUpperCase() === "CAR_RENTAL" &&
          Number(item.quantity) > 0 &&
          vehicleIdentity(item) === vehicleIdentity(listing)
      )
    : [];

  const raiseCount = async () => {
    const next = Number(count);
    if (!Number.isInteger(next) || next <= Number(listing.quantity || 0)) {
      setError(`Enter a number above the current ${listing.quantity}.`);
      return;
    }
    try {
      setSaving(true);
      setError("");
      await operatorService.quickEditListing(listing.id, { quantity: next });
      setMessage(`Car count is now ${next}. New requests for these dates can be accepted.`);
      await onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't change the car count. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="operator-card stock-alert" role="region" aria-labelledby="stock-alert-title">
      <div className="stock-alert-head">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <h2 id="stock-alert-title">
            {listing.name}
            {listing.branch?.name ? ` (${listing.branch.name})` : ""} is fully booked
          </h2>
          <p>
            On {datesText}. Customers can&apos;t request it for {sorted.length === 1 ? "this date" : "these dates"} until
            a car is free.
          </p>
        </div>
        <button type="button" className="stock-alert-close" onClick={onDismiss} aria-label="Dismiss the alert">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {message && (
        <p className="operator-alert" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="operator-alert danger" role="alert">
          {error}
        </p>
      )}

      <div className="stock-alert-actions">
        <div className="stock-alert-action">
          <strong>Add a car</strong>
          <p>Raise the car count if you have another one of this {isCar ? "model" : "package"} for the platform.</p>
          <div className="stock-alert-inline">
            <label htmlFor="stock-alert-count">Car count</label>
            <input
              id="stock-alert-count"
              type="number"
              min={Number(listing.quantity || 0) + 1}
              value={count}
              onChange={(event) => {
                setCount(event.target.value);
                setError("");
              }}
            />
            <button type="button" className="operator-primary-btn" disabled={saving} onClick={raiseCount}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {isCar && (
          <div className="stock-alert-action">
            <strong>Move a car from another branch</strong>
            {sources.length ? (
              <ul className="stock-alert-sources">
                {sources.map((source) => (
                  <li key={source.id}>
                    <span>
                      {source.branch?.name || "Branch"}: {source.quantity} car{Number(source.quantity) === 1 ? "" : "s"}
                    </span>
                    <button type="button" className="operator-secondary-btn" onClick={() => setTransferFrom(source.id)}>
                      Move a car
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No other branch has a matching car to move.</p>
            )}
          </div>
        )}

        {isCar && (
          <div className="stock-alert-action">
            <strong>Daily Stock</strong>
            <p>If you lowered the stock on these dates, restore it here.</p>
            <button type="button" className="operator-secondary-btn" onClick={() => setShowDailyStock(true)}>
              Open Daily Stock
            </button>
          </div>
        )}
      </div>

      {transferFrom && (
        <OperatorBranchTransfer
          initialSourceListingId={transferFrom}
          initialDestinationListingId={listing.id}
          onClose={async () => {
            setTransferFrom(null);
            await onUpdated?.();
          }}
        />
      )}

      {showDailyStock && (
        <OperatorDailyStock
          listing={listing}
          initialFrom={sorted[0]}
          initialTo={sorted[sorted.length - 1]}
          onClose={() => setShowDailyStock(false)}
          onUpdated={onUpdated}
        />
      )}
    </section>
  );
}
