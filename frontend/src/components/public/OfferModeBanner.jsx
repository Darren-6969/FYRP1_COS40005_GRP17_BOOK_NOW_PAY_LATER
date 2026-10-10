import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import styles from "../../assets/styles/public/OfferModeBanner.module.css";

// Shown on a car's public page when the customer opened it from an
// alternative car offer (?offer=<booking id>). The page is for looking only:
// the price, pick-up and add-ons are on the offer, and accepting happens there,
// so the car cannot be booked a second time from here.
export default function OfferModeBanner({ bookingId, operatorName, placement = "top" }) {
  const href = `/customer/bookings/${bookingId}`;

  if (placement === "bottom") {
    return (
      <div className={styles.bottom}>
        <p className={styles.bottomText}>
          <span className={styles.bottomLabel}>Offered for your booking</span>
          Ready to decide? Accept or decline on your offer.
        </p>
        <Link to={href} className={styles.bottomButton}>
          <ChevronLeft size={18} aria-hidden="true" />
          Back to your offer
        </Link>
      </div>
    );
  }

  return (
    <aside className={styles.banner} aria-label="Viewing an offered car">
      <div className={styles.text}>
        <strong>{operatorName ? `${operatorName} offered you this car` : "This car was offered to you"}</strong>
        <span>
          You're looking at it for your existing booking. The price, pick-up and add-ons are on your offer, and you
          accept or decline it there.
        </span>
      </div>
      <Link to={href} className={styles.button}>
        <ChevronLeft size={18} aria-hidden="true" />
        Back to your offer
      </Link>
    </aside>
  );
}

// Offer mode: an add-on's place in the offer, instead of the add/remove controls.
export function OfferAddonStatus({ qty }) {
  return qty > 0 ? (
    <span className={styles.addonIn}>In your offer{qty > 1 ? ` × ${qty}` : ""}</span>
  ) : (
    <span className={styles.addonOut}>Not in your offer</span>
  );
}
