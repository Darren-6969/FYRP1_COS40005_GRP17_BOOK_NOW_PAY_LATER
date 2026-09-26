import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { formatSen, formatShortDateTime } from "../../utils/formatPublic";
import styles from "../../assets/styles/public/BookingSummary.module.css";

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Sidebar on the booking form. Displays the server quote; computes nothing.
export default function BookingSummary({ listing, quote, eligibility, editHref }) {
  const b = listing.booking;
  const title = `${listing.vehicleMake} ${listing.vehicleModel}`;
  const primary = listing.images.find((img) => img.isPrimary) || listing.images[0];
  const days = quote?.days || 0;
  const daysText = plural(days, "day");

  const lines = [];
  if (quote) {
    lines.push({
      k: quote.weekendDays
        ? `Rental ${daysText}, ${quote.weekendDays} at the weekend rate`
        : `Rental ${daysText} × ${formatSen(b.rateRules.weekdaySen)}`,
      v: quote.rentalSen,
    });
    quote.addOnLines.forEach((a) => {
      const unit = b.addOns.find((x) => x.id === a.id)?.unit;
      lines.push({ k: `${a.label} × ${a.qty}${unit === "per_day" ? `, ${daysText}` : ""}`, v: a.amountSen });
    });
    if (quote.pickupFeeSen) lines.push({ k: quote.pickupPoint.label, v: quote.pickupFeeSen });
    if (quote.surchargeSen)
      lines.push({
        k: `Young driver surcharge ${daysText} × ${formatSen(b.youngDriver.surchargeSen)}`,
        v: quote.surchargeSen,
      });
  }

  let ageLine = "Add date of birth to confirm the price";
  if (eligibility?.age !== null && eligibility?.age !== undefined) {
    ageLine = eligibility.underage
      ? `Driver age ${eligibility.age} is below the minimum of ${eligibility.minAge}`
      : `Priced for driver age ${eligibility.age}`;
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
            {title} <span className={styles.similar}>or similar</span>
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
            <dt>Pick-up point</dt>
            <dd>{quote?.pickupPoint.label || "Not set"}</dd>
          </div>
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
            <dd>{quote ? daysText : "Not set"}</dd>
          </div>
        </dl>
        <p className={`${styles.ageLine} ${eligibility?.underage ? styles.ageLineError : ""}`}>{ageLine}</p>
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
          </div>

          <div className={styles.payBox}>
            <div className={styles.payNow}>
              <div className={styles.payLabel}>{quote.payInFull ? "Full amount" : "Deposit"}</div>
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
                {quote.payInFull
                  ? "Nothing left to pay later"
                  : `Balance ${formatSen(quote.balanceSen)} by ${formatShortDateTime(quote.balanceDueAt)}`}
              </div>
              <div className={styles.muted}>
                {quote.payInFull ? "Upload your driving licence before pick-up" : "Includes add-ons and fees"}
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
