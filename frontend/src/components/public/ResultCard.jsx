import { operatorHref } from "../../services/listing_public_service";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { formatResponseTime, formatSen } from "../../utils/formatPublic";
import { durationText } from "../../utils/carPricing";
import styles from "../../assets/styles/public/ResultCard.module.css";

const TRANSMISSION = { AUTOMATIC: "Automatic", MANUAL: "Manual" };

// One car in the results list. `href` already carries the trip (dates, age).
export default function ResultCard({ result, href, linkState, saved, onToggleSave }) {
  const { listing, quote, rateSen, depositPct, depositPerDaySen, remaining } = result;
  const primary = listing.images.find((img) => img.isPrimary) || listing.images[0];
  const title = `${listing.vehicleMake} ${listing.vehicleModel}`;
  const meta = [listing.vehicleType, `${listing.seats} seats`, TRANSMISSION[listing.transmission], listing.fuelType]
    .filter(Boolean)
    .join(", ");

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {primary ? (
          <img src={primary.imageUrl} alt="" className={styles.img} />
        ) : (
          <span className={styles.slot} aria-hidden="true">
            vehicle photo
            <br />
            {title}
          </span>
        )}
        <span className={styles.tag}>{listing.vehicleType}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>
              <Link to={href} state={linkState} className={styles.titleLink}>
                {title}
              </Link>
            </h3>
            <div className={styles.metaRow}>
              <span className={styles.meta}>{meta}</span>
              {listing.policy.unlimitedMileage && <span className={styles.pill}>Unlimited mileage</span>}
            </div>
          </div>
          <button
            type="button"
            className={`${styles.save} ${saved ? styles.saveOn : ""}`}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${title} from saved` : `Save ${title} for later`}
            onClick={onToggleSave}
          >
            <Heart size={18} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>

        <div className={styles.operatorRow}>
          <span className={styles.operator}>
            <Link to={operatorHref(listing.operator)} className={styles.operatorLink}>
              {listing.operator.companyName}
            </Link>{" "}
            ({listing.branch.name})
          </span>
          {listing.operator.verified && <span className={styles.verified}>Verified</span>}
        </div>
        <p className={styles.response}>{formatResponseTime(listing.operatorStats.responseTimeMins)}</p>

        <div className={styles.foot}>
          <div className={styles.pay}>
            {quote && remaining <= 2 && (
              <p className={styles.scarcity}>
                Only {remaining} left for these dates
              </p>
            )}
            <p className={styles.payLabel}>
              {quote ? "Deposit" : "Deposit from"}
              <span className={styles.pctInLabel}>
                {" "}
                · {depositPct}% of rental
              </span>
            </p>
            <p className={styles.payFigure}>{formatSen(quote ? quote.depositSen : depositPerDaySen)}</p>
            <p className={styles.payWhen}>paid after the operator confirms</p>
            <p className={styles.paySub}>
              {quote
                ? `${formatSen(quote.totalSen)} rental for ${durationText(quote.hours)}`
                : `${formatSen(rateSen)}/day · set dates for the total`}
              <span className={styles.pctInSub}>
                {" "}
                · {depositPct}% of rental
              </span>
            </p>
          </div>
          <Link to={href} state={linkState} className={styles.view} aria-label={`View ${title}`}>
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
