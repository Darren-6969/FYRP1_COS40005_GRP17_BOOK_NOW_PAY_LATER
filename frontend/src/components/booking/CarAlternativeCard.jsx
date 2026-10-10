import { Link } from "react-router-dom";

import { formatCustomerDate } from "../../utils/customerUtils";
import { toBookingParams } from "../../utils/carSearchParams";
import { carTitle, formatSen } from "./carBookingParts";

import "../../assets/styles/car-offer-card.css";

// ===========================================================
// Alternative car offer (Module 3), customer side.
//
// Leads with what changes if the customer accepts (car, pick-up
// place, dates, price), then the before/now price table, the
// payment steps and the operator's reason. Every figure comes from
// the server: the original booking's pricing snapshot and the quote
// for the offered car, so what is shown is what will be charged.
// ===========================================================

const KL = "Asia/Kuala_Lumpur";

// "2026-10-20" and "10:00" in Malaysia time, for the car page link.
function klParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "", time: "" };

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: KL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: KL,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return { day, time };
}

function specsText(listing) {
  return [
    listing?.transmission,
    listing?.seats ? `${listing.seats} seats` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Where the customer collects the car, from a pricing snapshot.
function placeOf(pricing, listing, requestedLocation) {
  if (pricing?.requestedLocation || requestedLocation) {
    return {
      key: `requested:${pricing?.requestedLocation || requestedLocation}`,
      label: `Requested: ${pricing?.requestedLocation || requestedLocation}`,
      address: "",
      branch: listing?.branch?.name || "",
    };
  }

  const point = pricing?.pickupPoint;

  return {
    key: `${listing?.branch?.name || ""}:${point?.id ?? ""}:${point?.label ?? ""}`,
    label: point?.label || listing?.branch?.name || "-",
    address: point?.address || listing?.branch?.address || "",
    branch: listing?.branch?.name || "",
  };
}

// Charge lines matched by name between the two quotes. Rows with
// nothing on either side are left out.
function comparisonRows(before, now) {
  const rows = [];
  const add = (label, beforeSen, nowSen) => {
    if (!beforeSen && !nowSen) return;
    rows.push({ label, beforeSen: beforeSen || 0, nowSen: nowSen || 0 });
  };

  add(
    `Rental, ${now?.days || before?.days || 0} ${
      (now?.days || before?.days) === 1 ? "day" : "days"
    }`,
    before?.rentalSen,
    now?.rentalSen
  );
  add("Night handover charge", before?.overtimeSen, now?.overtimeSen);

  const lines = new Map();
  (before?.addOnLines || []).forEach((line) =>
    lines.set(line.label, { beforeSen: line.amountSen, nowSen: 0 })
  );
  (now?.addOnLines || []).forEach((line) =>
    lines.set(line.label, {
      beforeSen: lines.get(line.label)?.beforeSen || 0,
      nowSen: line.amountSen,
    })
  );
  lines.forEach((value, label) => add(label, value.beforeSen, value.nowSen));

  add(
    "Young driver surcharge",
    before?.youngDriverSurchargeSen || before?.surchargeSen,
    now?.youngDriverSurchargeSen || now?.surchargeSen
  );
  add("Pick-up charge", before?.pickupFeeSen, now?.pickupFeeSen);
  add("Drop-off charge", before?.dropoffFeeSen, now?.dropoffFeeSen);

  return rows;
}

function CarPhoto({ listing, className, label }) {
  return listing?.imageUrl ? (
    <img className={className} src={listing.imageUrl} alt={label} />
  ) : (
    <span
      className={`${className} coc-photo-empty`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
    >
      <svg
        aria-hidden="true"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 13l2-5a2 2 0 0 1 2-1.3h10A2 2 0 0 1 19 8l2 5v4h-2" />
        <path d="M5 17H3v-4h18" />
        <circle cx="7.5" cy="17" r="1.8" />
        <circle cx="16.5" cy="17" r="1.8" />
      </svg>
    </span>
  );
}

export default function CarAlternativeCard({
  booking,
  onAccept,
  onDecline,
  busy = false,
}) {
  const car = booking.car;
  const alternative = car?.alternative;
  if (!alternative) return null;

  const before = car.pricing || {};
  const now = alternative.pricing || {};
  const quoteMeta = now.quote || {};
  const operatorName = booking.operator?.companyName || "The operator";

  const beforeTitle = carTitle(car.listing) || booking.serviceName;
  const nowTitle = carTitle(alternative.listing) || booking.alternativeServiceName;

  const beforePlace = placeOf(before, car.listing, booking.requestedLocation);
  const nowPlace = placeOf(now, alternative.listing, null);
  const placeChanged = beforePlace.key !== nowPlace.key;
  const branchChanged =
    Boolean(beforePlace.branch) &&
    Boolean(nowPlace.branch) &&
    beforePlace.branch !== nowPlace.branch;

  const datesChanged =
    new Date(alternative.pickupAt).getTime() !==
      new Date(booking.pickupDate).getTime() ||
    new Date(alternative.returnAt).getTime() !==
      new Date(booking.returnDate).getTime();

  const difference = (now.totalSen || 0) - (before.totalSen || 0);
  const rows = comparisonRows(before, now);

  // The line that moved the price most, to explain the difference.
  const biggest = rows
    .map((row) => ({ ...row, delta: row.nowSen - row.beforeSen }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  const priceReason =
    difference && biggest && biggest.delta
      ? biggest.label.startsWith("Rental")
        ? "mostly the daily rate"
        : `mostly ${biggest.label.toLowerCase()}`
      : "";

  const droppedAddons = quoteMeta.droppedAddons || [];

  const changeCount =
    1 + (placeChanged ? 1 : 0) + (datesChanged ? 1 : 0) + (difference ? 1 : 0);

  const unchanged = [
    !datesChanged &&
      `dates (${formatCustomerDate(booking.pickupDate)} → ${formatCustomerDate(
        booking.returnDate
      )})`,
    !placeChanged && "pick-up place",
    droppedAddons.length === 0 && (before.addOnLines?.length ? "your add-ons" : null),
  ].filter(Boolean);

  const payInFull = Number(now.depositPct) >= 100 || !now.balanceSen;

  // The offered car's public page, with the offer's dates and choices,
  // in offer mode so it cannot be booked as a second booking.
  const from = klParts(alternative.pickupAt);
  const to = klParts(alternative.returnAt);
  const carPageParams = toBookingParams({
    from: from.day,
    ft: from.time,
    to: to.day,
    tt: to.time,
    pickupPointId:
      now.pickupPoint && now.pickupPoint.id !== "branch"
        ? String(now.pickupPoint.id)
        : "",
    dropoffPointId:
      now.dropoffPoint && now.dropoffPoint.id !== "branch"
        ? String(now.dropoffPoint.id)
        : "",
    cdw: (now.addOnLines || []).some((line) => line.id === "cdw"),
    addOns: Object.fromEntries(
      (now.addOnLines || [])
        .filter((line) => line.id !== "cdw")
        .map((line) => [line.id, line.qty])
    ),
  });
  carPageParams.set("offer", String(booking.id));
  const carPageHref = alternative.listing?.id
    ? `/cars/${alternative.listing.id}?${carPageParams}`
    : null;

  return (
    <article className="coc" aria-labelledby={`coc-title-${booking.id}`}>
      <header className="coc-head">
        <div>
          <p className="coc-eyebrow">Alternative car offer</p>
          <h2 id={`coc-title-${booking.id}`}>
            Your {beforeTitle} isn't available. {operatorName} offered
            another car.
          </h2>
        </div>
        <span className="coc-badge">Your answer needed</span>
      </header>

      <section className="coc-section" aria-labelledby={`coc-changes-${booking.id}`}>
        <h3 id={`coc-changes-${booking.id}`} className="coc-h3">
          {changeCount} {changeCount === 1 ? "thing changes" : "things change"}{" "}
          if you accept
        </h3>

        <ol className="coc-changes">
          <li className="coc-change">
            <span className="coc-change-label">Car</span>

            <div className="coc-photos">
              <CarPhoto
                listing={car.listing}
                className="coc-photo-before"
                label={`${beforeTitle}, the car you requested`}
              />
              <svg
                className="coc-arrow"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              {carPageHref ? (
                <Link
                  to={carPageHref}
                  className="coc-photo-link"
                  aria-label={`See details of ${nowTitle}`}
                >
                  <CarPhoto
                    listing={alternative.listing}
                    className="coc-photo-now"
                    label=""
                  />
                </Link>
              ) : (
                <CarPhoto
                  listing={alternative.listing}
                  className="coc-photo-now"
                  label={`${nowTitle}, the car offered instead`}
                />
              )}
            </div>

            <span className="coc-before">{beforeTitle}</span>
            <span className="coc-now">→ {nowTitle}</span>
            <span className="coc-sub">
              {specsText(alternative.listing)}
              {specsText(alternative.listing) &&
              specsText(alternative.listing) === specsText(car.listing)
                ? ", same as before"
                : ""}
            </span>

            {carPageHref && (
              <Link to={carPageHref} className="coc-link">
                See car details
              </Link>
            )}
          </li>

          {placeChanged && (
            <li className={`coc-change${branchChanged ? " is-warning" : ""}`}>
              <span className="coc-change-label">Pick-up place</span>
              <span className="coc-before">
                {beforePlace.label}
                {beforePlace.branch && beforePlace.branch !== beforePlace.label
                  ? `, ${beforePlace.branch}`
                  : ""}
              </span>
              <span className="coc-now">→ {nowPlace.label}</span>
              <span className="coc-sub">
                {[nowPlace.branch !== nowPlace.label ? nowPlace.branch : null, nowPlace.address]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {branchChanged && (
                <span className="coc-warn">
                  Different branch. Check you can get there.
                </span>
              )}
            </li>
          )}

          {datesChanged && (
            <li className="coc-change is-warning">
              <span className="coc-change-label">Dates</span>
              <span className="coc-before">
                {formatCustomerDate(booking.pickupDate)} →{" "}
                {formatCustomerDate(booking.returnDate)}
              </span>
              <span className="coc-now">
                → {formatCustomerDate(alternative.pickupAt)} →{" "}
                {formatCustomerDate(alternative.returnAt)}
              </span>
            </li>
          )}

          {difference !== 0 && (
            <li className={`coc-change${difference > 0 ? " is-warning" : " is-good"}`}>
              <span className="coc-change-label">Price</span>
              <span className="coc-before">{formatSen(before.totalSen)}</span>
              <span className="coc-now coc-now-price">
                → {formatSen(now.totalSen)}
              </span>
              <span className={difference > 0 ? "coc-warn" : "coc-good"}>
                {formatSen(Math.abs(difference))}{" "}
                {difference > 0 ? "more" : "less"}
                {priceReason ? `, ${priceReason}` : ""}
              </span>
            </li>
          )}
        </ol>

        {(unchanged.length > 0 || droppedAddons.length > 0) && (
          <p className="coc-muted">
            {unchanged.length > 0 && `Unchanged: ${unchanged.join(", ")}.`}
            {droppedAddons.length > 0 &&
              ` Not offered with this car, so not included: ${droppedAddons.join(", ")}.`}
          </p>
        )}
      </section>

      <div className="coc-grid">
        <section className="coc-panel" aria-labelledby={`coc-price-${booking.id}`}>
          <h3 id={`coc-price-${booking.id}`} className="coc-h3">
            New price
          </h3>

          <table className="coc-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="coc-sr-only">Charge</span>
                </th>
                <th scope="col">Before</th>
                <th scope="col" className="is-now">Now</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Daily rate</th>
                <td>{formatSen(before.rateCard?.dailySen)}</td>
                <td className="is-now">{formatSen(now.rateCard?.dailySen)}</td>
              </tr>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatSen(row.beforeSen)}</td>
                  <td className="is-now">{formatSen(row.nowSen)}</td>
                </tr>
              ))}
              <tr className="coc-total-row">
                <th scope="row">Total</th>
                <td>{formatSen(before.totalSen)}</td>
                <td className="is-now coc-total">{formatSen(now.totalSen)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="coc-side">
          <section className="coc-panel" aria-labelledby={`coc-pay-${booking.id}`}>
            <h3 id={`coc-pay-${booking.id}`} className="coc-h3">
              If you accept
            </h3>

            <ol className="coc-steps">
              <li>
                <span className="coc-step is-first" aria-hidden="true">1</span>
                <span className="coc-step-text">
                  {payInFull ? "Pay the full amount" : "Pay the deposit"}
                  <small>
                    {payInFull
                      ? "Due soon after you accept"
                      : `${now.depositPct}% of the rental, due soon after you accept`}
                  </small>
                </span>
                <strong>{formatSen(now.depositSen)}</strong>
              </li>

              {!payInFull && (
                <li>
                  <span className="coc-step" aria-hidden="true">2</span>
                  <span className="coc-step-text">
                    Pay the balance before pick-up
                    <small>Add-ons and charges are paid here</small>
                  </span>
                  <strong>{formatSen(now.balanceSen)}</strong>
                </li>
              )}

              <li>
                <span className="coc-step" aria-hidden="true">
                  {payInFull ? 2 : 3}
                </span>
                <span className="coc-step-text">
                  Collect the car at {nowPlace.label}
                  <small>{formatCustomerDate(alternative.pickupAt)}</small>
                </span>
              </li>
            </ol>

            <p className="coc-muted">
              Exact due dates are set when you accept. Nothing is charged
              before that.
            </p>
          </section>

          {alternative.reason && (
            <section className="coc-reason" aria-labelledby={`coc-reason-${booking.id}`}>
              <h3 id={`coc-reason-${booking.id}`} className="coc-h3">
                Why they suggested it
              </h3>
              <p>“{alternative.reason}”</p>
            </section>
          )}
        </div>
      </div>

      <footer className="coc-actions">
        <p className="coc-muted">
          Declining closes this booking. You can then book another car.
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

