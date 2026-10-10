import { formatCustomerDate } from "../../utils/customerUtils";
import { carTitle, depositLabel, formatSen } from "./carBookingParts";

import "../../assets/styles/car-offer-card.css";

// ===========================================================
// Requested place charges (Module 4), customer side.
//
// The customer asked for their own pickup place, drop-off place,
// or both on the booking form. The operator has priced it (FR-LIST-004) and sent
// it as an offer on the same car and dates. Every figure comes
// from the server: the booking's pricing snapshot before, and the
// offer's snapshot now, so what is shown is what will be charged.
// ===========================================================

export default function LocationChargeCard({
  booking,
  onAccept,
  onDecline,
  busy = false,
}) {
  const car = booking.car;
  const offer = car?.alternative;
  if (!offer) return null;

  const before = car.pricing || {};
  const now = offer.pricing || {};
  const quote = now.quote || {};
  const chargeSen = quote.locationChargeSen || 0;
  const pickupPlace = now.requestedLocation || before.requestedLocation || "";
  const dropoffPlace = now.requestedDropoffLocation || before.requestedDropoffLocation || "";
  const samePlace = Boolean(pickupPlace) && now.dropoffPoint?.id === "requested";

  // One line per requested place, as the operator priced it.
  const places = [
    pickupPlace && {
      key: "pickup",
      label: samePlace ? "Pickup and return" : "Pickup",
      place: pickupPlace,
      beforeSen: before.pickupPoint?.requested ? before.pickupFeeSen : 0,
      nowSen: quote.pickupChargeSen || 0,
    },
    dropoffPlace && {
      key: "dropoff",
      label: "Drop-off",
      place: dropoffPlace,
      beforeSen: before.dropoffPoint?.requested ? before.dropoffFeeSen : 0,
      nowSen: quote.dropoffChargeSen || 0,
    },
  ].filter(Boolean);

  const headline =
    places.length === 2
      ? `${places[0].place} and ${places[1].place}`
      : places[0]?.place || "your requested place";
  const collectAt = pickupPlace || before.pickupPoint?.label || "the pickup point";

  const operatorName = booking.operator?.companyName || "The operator";
  const title = carTitle(car.listing) || booking.serviceName;
  const payInFull = Number(now.depositPct) >= 100 || !now.balanceSen;
  const depositChanged = (now.depositSen || 0) !== (before.depositSen || 0);

  // Shown only when it is more than the default the server fills in.
  const note =
    offer.reason && offer.reason !== "Charge for the requested location"
      ? offer.reason
      : "";

  return (
    <article className="coc" aria-labelledby={`lcc-title-${booking.id}`}>
      <header className="coc-head">
        <div>
          <p className="coc-eyebrow">Charge for your requested place</p>
          <h2 id={`lcc-title-${booking.id}`}>
            {operatorName} can meet you at {headline} for{" "}
            {formatSen(chargeSen)}.
          </h2>
        </div>
        <span className="coc-badge">Your answer needed</span>
      </header>

      <section
        className="coc-section"
        aria-labelledby={`lcc-changes-${booking.id}`}
      >
        <h3 id={`lcc-changes-${booking.id}`} className="coc-h3">
          1 thing changes if you accept
        </h3>

        <ol className="coc-changes">
          <li className="coc-change is-warning">
            <span className="coc-change-label">Price</span>
            <span className="coc-before">{formatSen(before.totalSen)}</span>
            <span className="coc-now coc-now-price">
              → {formatSen(now.totalSen)}
            </span>
            <span className="coc-warn">
              {formatSen(chargeSen)} more, for{" "}
              {places
                .filter((p) => p.nowSen)
                .map((p) => `${p.label.toLowerCase()} at ${p.place}`)
                .join(" and ")}
            </span>
          </li>
        </ol>

        <p className="coc-muted">
          Unchanged: {title}, dates ({formatCustomerDate(booking.pickupDate)} →{" "}
          {formatCustomerDate(booking.returnDate)})
          {before.addOnLines?.length ? ", your add-ons" : ""}.
        </p>
      </section>

      <div className="coc-grid">
        <section
          className="coc-panel"
          aria-labelledby={`lcc-price-${booking.id}`}
        >
          <h3 id={`lcc-price-${booking.id}`} className="coc-h3">
            New price
          </h3>

          <table className="coc-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="coc-sr-only">Charge</span>
                </th>
                <th scope="col">Before</th>
                <th scope="col" className="is-now">
                  Now
                </th>
              </tr>
            </thead>
            <tbody>
              {places.map((p) => (
                <tr key={p.key}>
                  <th scope="row">
                    {p.label} at {p.place}
                  </th>
                  <td>{formatSen(p.beforeSen)}</td>
                  <td className="is-now">
                    {p.nowSen ? formatSen(p.nowSen) : "Free"}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row">{depositLabel(now)}</th>
                <td>{formatSen(before.depositSen)}</td>
                <td className="is-now">{formatSen(now.depositSen)}</td>
              </tr>
              {!payInFull && (
                <tr>
                  <th scope="row">Balance</th>
                  <td>{formatSen(before.balanceSen)}</td>
                  <td className="is-now">{formatSen(now.balanceSen)}</td>
                </tr>
              )}
              <tr className="coc-total-row">
                <th scope="row">Total</th>
                <td>{formatSen(before.totalSen)}</td>
                <td className="is-now coc-total">{formatSen(now.totalSen)}</td>
              </tr>
            </tbody>
          </table>

          {!payInFull && !depositChanged && (
            <p className="coc-muted">
              Your deposit stays the same. The charge is added to the
              balance.
            </p>
          )}
        </section>

        <div className="coc-side">
          <section
            className="coc-panel"
            aria-labelledby={`lcc-pay-${booking.id}`}
          >
            <h3 id={`lcc-pay-${booking.id}`} className="coc-h3">
              If you accept
            </h3>

            <ol className="coc-steps">
              <li>
                <span className="coc-step is-first" aria-hidden="true">
                  1
                </span>
                <span className="coc-step-text">
                  {payInFull ? "Pay the full amount" : "Pay the deposit"}
                  <small>Due soon after you accept</small>
                </span>
                <strong>{formatSen(now.depositSen)}</strong>
              </li>

              {!payInFull && (
                <li>
                  <span className="coc-step" aria-hidden="true">
                    2
                  </span>
                  <span className="coc-step-text">
                    Pay the balance before pick-up
                    <small>Includes the place charges</small>
                  </span>
                  <strong>{formatSen(now.balanceSen)}</strong>
                </li>
              )}

              <li>
                <span className="coc-step" aria-hidden="true">
                  {payInFull ? 2 : 3}
                </span>
                <span className="coc-step-text">
                  Collect the car at {collectAt}
                  <small>{formatCustomerDate(booking.pickupDate)}</small>
                </span>
              </li>
            </ol>

            <p className="coc-muted">
              Exact due dates are set when you accept. Nothing is charged
              before that.
            </p>
          </section>

          {note && (
            <section
              className="coc-reason"
              aria-labelledby={`lcc-reason-${booking.id}`}
            >
              <h3 id={`lcc-reason-${booking.id}`} className="coc-h3">
                Note from {operatorName}
              </h3>
              <p>“{note}”</p>
            </section>
          )}
        </div>
      </div>

      <footer className="coc-actions">
        <p className="coc-muted">
          Declining closes this booking. You can then book again with a
          pick-up point from the list.
        </p>

        <div className="coc-buttons">
          <button
            type="button"
            className="coc-btn coc-btn-secondary"
            onClick={onDecline}
            disabled={busy}
          >
            Decline
          </button>

          <button
            type="button"
            className="coc-btn coc-btn-primary"
            onClick={onAccept}
            disabled={busy}
          >
            {busy ? "Please wait…" : `Accept for ${formatSen(now.totalSen)}`}
          </button>
        </div>
      </footer>
    </article>
  );
}
