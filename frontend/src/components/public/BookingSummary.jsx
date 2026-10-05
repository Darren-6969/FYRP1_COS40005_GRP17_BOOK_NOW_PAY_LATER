import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { formatSen, formatShortDateTime } from "../../utils/formatPublic";
import { durationText, rateLineLabel } from "../../utils/carPricing";
import styles from "../../assets/styles/public/BookingSummary.module.css";

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Sidebar on the booking form. Displays the server quote; computes nothing.
export default function BookingSummary({ listing, quote, editHref }) {
  const b = listing.booking;
  const title = `${listing.vehicleMake} ${listing.vehicleModel}`;
  const primary = listing.images.find((img) => img.isPrimary) || listing.images[0];
  const days = quote?.days || 0;
  const daysText = plural(days, "day");
  const lengthText = quote ? durationText(quote.hours) : "";
  const sameReturn = quote && quote.dropoffPoint && quote.dropoffPoint.id === quote.pickupPoint.id;

  const lines = [];
  if (quote) {
    (quote.rateLines || []).forEach((l) => lines.push({ k: `Rental ${rateLineLabel(l, formatSen)}`, v: l.amountSen }));
    if (quote.overtimeSen)
      lines.push({
        k: `Night handover ${quote.nightHandovers === 1 ? "charge" : `× ${quote.nightHandovers}`}`,
        v: quote.overtimeSen,
      });
    quote.addOnLines.forEach((a) => {
      const unit = a.id === "cdw" ? "per_day" : b.addOns.find((x) => x.id === a.id)?.unit;
      lines.push({ k: `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ""}${unit === "per_day" ? `, ${daysText}` : ""}`, v: a.amountSen });
    });
    if (quote.pickupFeeSen) lines.push({ k: `Pickup at ${quote.pickupPoint.label}`, v: quote.pickupFeeSen });
    if (quote.dropoffFeeSen) lines.push({ k: `Drop-off at ${quote.dropoffPoint.label}`, v: quote.dropoffFeeSen });
  }

  return (
    <aside className={styles.summary} aria-label="Booking summary">
      <div className={styles.free}>
        <ShieldCheck size={18} aria-hidden="true" />
        Nothing is charged today
      </div>

      <div className={styles.car}>
        {primary ? (
          <img src={primary.imageUrl} alt="" className={styles.thumb} />
        ) : (
          <div className={styles.thumb} aria-hidden="true">
            {listing.vehicleModel}
          </div>
        )}
        <div className={styles.carText}>
          <div className={styles.carTitle}>
            {title}
          </div>
          <span className={styles.muted}>{listing.vehicleType}</span>
          <div className={styles.operatorRow}>
            <span className={styles.operator}>
              {listing.operator.companyName} <span className={styles.branch}>({listing.branch.name})</span>
            </span>
            {listing.operator.verified && <span className={styles.verified}>Verified</span>}
          </div>
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.h2}>Your trip</h2>
          <Link to={editHref} className={styles.edit}>
            Edit trip
          </Link>
        </div>
        <dl className={styles.dl}>
          <div className={styles.row}>
            <dt>{quote?.requestedLocation ? "Requested location" : "Pickup point"}</dt>
            <dd>{quote?.pickupPoint.label || "Not set"}</dd>
          </div>
          {quote && !quote.requestedLocation && (
            <div className={styles.row}>
              <dt>Drop-off point</dt>
              <dd>{sameReturn ? "Same as pickup" : quote.dropoffPoint?.label || "Not set"}</dd>
            </div>
          )}
          <div className={styles.row}>
            <dt>Pick-up</dt>
            <dd>{quote ? formatShortDateTime(quote.pickupAt) : "Not set"}</dd>
          </div>
          <div className={styles.row}>
            <dt>Return</dt>
            <dd>{quote ? formatShortDateTime(quote.returnAt) : "Not set"}</dd>
          </div>
          <div className={styles.row}>
            <dt>Rental length</dt>
            <dd>{quote ? lengthText : "Not set"}</dd>
          </div>
        </dl>
      </div>

      {quote && (
        <>
          <div className={styles.block}>
            <h2 className={styles.h2}>Price breakdown</h2>
            <dl className={styles.dl}>
              {lines.map((l) => (
                <div key={l.k} className={styles.row}>
                  <dt>{l.k}</dt>
                  <dd>{formatSen(l.v)}</dd>
                </div>
              ))}
              <div className={`${styles.row} ${styles.total}`}>
                <dt>Total</dt>
                <dd>{formatSen(quote.totalSen)}</dd>
              </div>
            </dl>
            {quote.requestedLocation && (
              <p className={styles.muted}>
                The operator replies with any charge for your requested location. You accept it before paying anything.
              </p>
            )}
          </div>

          <div className={styles.payBox}>
            <div className={styles.payNow}>
              <div className={styles.payLabel}>{quote.payInFull || !quote.balanceSen ? "Full amount" : quote.depositSen ? "Deposit" : "No deposit"}</div>
              <div className={styles.payFigureRow}>
                <span className={styles.payFigure}>{formatSen(quote.payInFull ? quote.totalSen : quote.depositSen)}</span>
                <span className={styles.payNote}>
                  {quote.payInFull
                    ? `due within ${quote.depositWindowHours} hours of acceptance, pick-up is within the balance window`
                    : `due within ${quote.depositWindowHours} hours of acceptance`}
                </span>
              </div>
            </div>
            <div className={styles.later}>
              <div className={styles.laterLine}>
                {quote.payInFull || !quote.balanceSen
                  ? "Nothing left to pay later"
                  : `Balance ${formatSen(quote.balanceSen)} by ${formatShortDateTime(quote.balanceDueAt)}`}
              </div>
              <div className={styles.muted}>
                {quote.payInFull || !quote.balanceSen ? "Upload your driving licence before pickup" : "Includes add-ons and fees"}
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
