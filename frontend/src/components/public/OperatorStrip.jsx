import { Link } from "react-router-dom";
import { BRAND } from "../../constants/brand";
import { FEATURES } from "../../constants/features";
import { formatMonthYear, formatResponseTime } from "../../utils/formatPublic";
import { operatorHref } from "../../services/listing_public_service";
import styles from "../../assets/styles/public/OperatorStrip.module.css";

function initials(name) {
  return name
    .replace(/Sdn\.? Bhd\.?/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Who the customer is asking, and how reliably they answer.
export default function OperatorStrip({ operator, branch, stats, rating }) {
  const bookingsWord = operator.completedBookings === 1 ? "booking" : "bookings";
  const branchesWord = operator.branchCount === 1 ? "branch" : "branches";
  return (
    <section className={styles.strip} aria-label="Operator">
      <div className={styles.who}>
        {operator.logoUrl ? (
          <img src={operator.logoUrl} alt="" className={styles.logo} />
        ) : (
          <span className={styles.logo} aria-hidden="true">
            {initials(operator.companyName)}
          </span>
        )}
        <div className={styles.lines}>
          <div className={styles.nameRow}>
            <Link to={operatorHref(operator)} className={styles.name}>
              {operator.companyName} <span className={styles.branch}>({branch.name})</span>
            </Link>
            {operator.verified && <span className={styles.verified}>Verified</span>}
            {FEATURES.showRating && rating && (
              <span className={styles.rating}>
                {rating.average.toFixed(1)} <span className={styles.ratingCount}>({rating.count} reviews)</span>
              </span>
            )}
          </div>
          <span className={styles.meta}>
            {operator.completedBookings} completed {bookingsWord} · {operator.branchCount} {branchesWord} · On{" "}
            {BRAND.name}
            {BRAND.suffix} since {formatMonthYear(operator.activeSince)}
          </span>
          <span className={styles.meta}>
            {formatResponseTime(stats.responseTimeMins)}
            {stats.acceptanceRate !== null && stats.acceptanceRate !== undefined
              ? ` · Accepts ${stats.acceptanceRate}% of requests`
              : ""}
          </span>
        </div>
      </div>
      <Link to={operatorHref(operator)} className={styles.link}>
        Visit {operator.companyName}&apos;s page
      </Link>
    </section>
  );
}
